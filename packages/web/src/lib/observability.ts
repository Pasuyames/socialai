import { agentQueue } from "./queues";

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard kokpiti için gerçek zamanlı gözlemlenebilirlik verisi.
// - Kuyruk sayıları: BullMQ'dan CANLI (getJobCounts).
// - Langfuse token/maliyet: SADECE env anahtarları varsa ve API cevap verirse.
//   Aksi halde null → UI zarif "bağlan" durumu gösterir. ASLA uydurma değer.
// Tümü hataya/timeout'a dayanıklı: Redis/Langfuse düşse bile dashboard açılır.
// ─────────────────────────────────────────────────────────────────────────────

export interface QueueCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  ok: boolean; // Redis'e ulaşılabildi mi
}

export interface LangfuseMetrics {
  totalTokens: number;
  totalCostUsd: number;
  traces: number;
  fromDate: string;
}

const EMPTY_COUNTS: QueueCounts = {
  waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, ok: false,
};

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/** BullMQ kuyruk sayıları — Redis düşükse EMPTY_COUNTS (ok:false) döner, asılmaz. */
export async function getQueueCounts(): Promise<QueueCounts> {
  try {
    const counts = await withTimeout(
      agentQueue.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
      2500,
      null as any,
    );
    if (!counts) return EMPTY_COUNTS;
    return {
      waiting:   counts.waiting   ?? 0,
      active:    counts.active    ?? 0,
      completed: counts.completed ?? 0,
      failed:    counts.failed    ?? 0,
      delayed:   counts.delayed   ?? 0,
      ok: true,
    };
  } catch {
    return EMPTY_COUNTS;
  }
}

/**
 * Langfuse günlük metrikleri (son 7 gün). Env anahtarları yoksa → null.
 * Public metrics API'sine Basic auth ile gider; hata/timeout → null.
 */
export async function getLangfuseMetrics(): Promise<LangfuseMetrics | null> {
  // trim(): .env'de anahtar satırı olup değeri boş tırnak olabiliyor — boş
  // string "ayarlanmış" sayılmamalı (aylarca sessizce kapalı kalmıştı).
  const pk = process.env.LANGFUSE_PUBLIC_KEY?.trim();
  const sk = process.env.LANGFUSE_SECRET_KEY?.trim();
  // Langfuse kurulum ekranı LANGFUSE_BASE_URL üretiyor; ikisi de kabul edilir
  // (bkz. lib/llm.ts getLangfuse — aynı gerekçe).
  const host =
    process.env.LANGFUSE_HOST?.trim() ||
    process.env.LANGFUSE_BASE_URL?.trim() ||
    "https://cloud.langfuse.com";
  if (!pk || !sk) return null;

  try {
    const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const auth = Buffer.from(`${pk}:${sk}`).toString("base64");

    // ── v2/metrics ──────────────────────────────────────────────────────────
    // Eskiden `/api/public/metrics/daily?fromTimestamp=YYYY-MM-DD` çağrılıyordu.
    // İKİ sorun vardı:
    //   1) API TAM ISO zaman damgası istiyor; tarih-only gövde 400 döndürüyordu.
    //      res.ok false olduğu için fonksiyon null dönüyor ve dashboard, geçerli
    //      anahtarlarla bile "Langfuse metrikleri bağlı değil" gösteriyordu —
    //      sessiz bir hata (canlı doğrulandı: tarih-only 400, tam ISO 200).
    //   2) O uç nokta Langfuse Cloud'da DEPRECATE; 16 Kasım 2026'da kaldırılıyor
    //      ve verisi ~10 dakika gecikmeli. v2 gerçek zamanlı.
    const query = {
      view: "observations",
      metrics: [
        { measure: "totalCost",   aggregation: "sum" },
        { measure: "totalTokens", aggregation: "sum" },
        { measure: "count",       aggregation: "count" },
      ],
      fromTimestamp: fromDate.toISOString(),
      toTimestamp:   new Date().toISOString(),
    };
    const url =
      `${host.replace(/\/$/, "")}/api/public/v2/metrics` +
      `?query=${encodeURIComponent(JSON.stringify(query))}`;

    const res = await withTimeout(
      fetch(url, { headers: { Authorization: `Basic ${auth}` }, cache: "no-store" }),
      3000,
      null as any,
    );
    if (!res || !res.ok) return null;

    const json = await res.json();
    // Değerler string ya da null gelebiliyor (ör. {"sum_totalCost":null}).
    const row: any = json?.data?.[0] ?? {};
    return {
      totalTokens:  Number(row.sum_totalTokens ?? 0) || 0,
      totalCostUsd: Number(row.sum_totalCost   ?? 0) || 0,
      traces:       Number(row.count_count     ?? 0) || 0,
      fromDate:     fromDate.toISOString().slice(0, 10),
    };
  } catch {
    return null;
  }
}
