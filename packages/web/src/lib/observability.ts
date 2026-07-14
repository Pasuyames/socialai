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
  const pk = process.env.LANGFUSE_PUBLIC_KEY;
  const sk = process.env.LANGFUSE_SECRET_KEY;
  const host = process.env.LANGFUSE_HOST ?? "https://cloud.langfuse.com";
  if (!pk || !sk) return null;

  try {
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);
    const auth = Buffer.from(`${pk}:${sk}`).toString("base64");
    const url = `${host.replace(/\/$/, "")}/api/public/metrics/daily?fromTimestamp=${from}`;

    const res = await withTimeout(
      fetch(url, { headers: { Authorization: `Basic ${auth}` }, cache: "no-store" }),
      3000,
      null as any,
    );
    if (!res || !res.ok) return null;

    const json = await res.json();
    const days: any[] = json?.data ?? [];
    let totalTokens = 0, totalCostUsd = 0, traces = 0;
    for (const d of days) {
      totalCostUsd += Number(d?.totalCost ?? 0);
      traces       += Number(d?.countTraces ?? 0);
      for (const u of d?.usage ?? []) {
        totalTokens += Number(u?.totalUsage ?? 0);
      }
    }
    return { totalTokens, totalCostUsd, traces, fromDate: from };
  } catch {
    return null;
  }
}
