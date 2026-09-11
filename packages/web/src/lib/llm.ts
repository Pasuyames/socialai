import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { Langfuse } from "langfuse";
import { safeFetch, readLimited } from "./security/ssrf";

/** Vision'a verilecek tek görsel için üst sınır — DoS/bellek şişirme koruması. */
const MAX_VISION_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

// ─── Model Seviyeleri ─────────────────────────────────────────────────────────
//
//  fast     → gemini-2.0-flash   (hashtag, CTA, basit görevler)
//  balanced → gemini-2.5-flash   (içerik yazımı, QA, zamanlama)
//  premium  → gemini-2.5-pro     (strateji, analiz, derin düşünme)
//
export type ModelTier = "fast" | "balanced" | "premium";

/** Bir LLM çağrısının token kullanımı (Langfuse + maliyet takibi için) */
export interface TokenUsage {
  input: number;   // promptTokenCount
  output: number;  // candidatesTokenCount
  total: number;   // totalTokenCount
}

export interface LLMOptions {
  tier?: ModelTier;
  taskName?: string;
  /** Langfuse trace bağlamı — planId veya postId ile trace'leri gruplamak için */
  traceId?: string;
  /**
   * Gemini native structured output: yanıt MIME türü. JSON üretiminde
   * "application/json" verilir → model markdown sarmalamadan saf JSON döndürür.
   */
  responseMimeType?: string;
  /**
   * Gemini native structured output şeması (Google/OpenAPI-subset formatı).
   * Verilirse model çıktıyı bu şemaya UYMAYA zorlanır (responseMimeType ile birlikte).
   */
  responseSchema?: Record<string, unknown>;
  /**
   * Token kullanımı geri çağrısı — her başarılı üretimde çağrılır. Langfuse
   * anahtarı olmasa bile maliyeti programatik izlemek/test etmek için.
   */
  onUsage?: (usage: TokenUsage) => void;
}

// ─── Model Haritası ───────────────────────────────────────────────────────────

// NOT: gemini-2.0-flash bu GCP projesinde erişilebilir DEĞİL (404). Bu yüzden
// fast tier de 2.5-flash'e bağlandı — aksi halde rate-limit fallback zinciri
// 2.0-flash'e düşüp tüm pipeline'ı 404 ile çökertiyordu.
const MODEL_IDS: Record<ModelTier, string> = {
  fast:     "gemini-2.5-flash",
  balanced: "gemini-2.5-flash",
  premium:  "gemini-2.5-pro",
};

// Rate limit durumunda FARKLI bir modele geç (gerçek rahatlama):
// flash rate-limit olursa pro'ya, pro olursa flash'e düş.
const FALLBACK_TIER: Partial<Record<ModelTier, ModelTier>> = {
  premium:  "balanced",
  balanced: "premium",
  fast:     "premium",
};

// ─── Langfuse Singleton (opsiyonel — env yoksa devre dışı) ───────────────────

let _langfuse: Langfuse | null = null;
let _langfuseUyarildi = false;

function getLangfuse(): Langfuse | null {
  if (_langfuse) return _langfuse;

  // .env'de anahtar SATIRI olup değeri boş/placeholder olabilir (gerçekten
  // yaşandı: değerler `""` idi ve tracing sessizce kapalı kaldı, kimse fark
  // etmedi). Boş string'i "ayarlanmış" saymayız ve durumu BİR KEZ loglarız —
  // sessiz devre dışılık bir tuzaktır.
  const pk = process.env.LANGFUSE_PUBLIC_KEY?.trim();
  const sk = process.env.LANGFUSE_SECRET_KEY?.trim();
  if (!pk || !sk) {
    if (!_langfuseUyarildi) {
      _langfuseUyarildi = true;
      console.warn(
        "[LLM] Langfuse izleme KAPALI — LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY boş. " +
        "Token maliyeti ve trace'ler kaydedilmeyecek.",
      );
    }
    return null;
  }

  _langfuse = new Langfuse({
    publicKey: pk,
    secretKey: sk,
    // Langfuse'un kendi kurulum ekranı `LANGFUSE_BASE_URL` üretiyor, bizim
    // yapılandırmamız `LANGFUSE_HOST` kullanıyordu. Snippet'i olduğu gibi
    // yapıştıran biri sessizce varsayılana düşerdi (self-hosted kurulumda
    // veri YANLIŞ sunucuya gitmeye çalışırdı) — iki isim de kabul edilir.
    baseUrl:
      process.env.LANGFUSE_HOST?.trim() ||
      process.env.LANGFUSE_BASE_URL?.trim() ||
      "https://cloud.langfuse.com",
    flushAt: 10,
    flushInterval: 5000,
  });
  return _langfuse;
}

/**
 * Bekleyen Langfuse trace'lerini hemen gönderir. Kısa ömürlü script'ler,
 * serverless fonksiyonlar ve graceful shutdown için ZORUNLU — aksi halde
 * buffer'daki trace'ler (token kullanımı dahil) panele ulaşmadan süreç biter.
 */
export async function flushLangfuse(): Promise<void> {
  await _langfuse?.flushAsync().catch(() => {});
}

// ─── Google GenAI Singleton ───────────────────────────────────────────────────

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (_client) return _client;

  const project =
    process.env.GCP_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT;

  if (!project) {
    throw new Error(
      "GCP_PROJECT_ID env değişkeni ayarlanmamış. .env dosyasını kontrol edin."
    );
  }

  const location = process.env.GCP_LOCATION || "us-central1";

  _client = new GoogleGenAI({ vertexai: true, project, location });
  return _client;
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function jitteredBackoff(attempt: number): number {
  const base = 2000;
  const cap  = 32000;
  return Math.min(base * Math.pow(2, attempt - 1) + Math.random() * 1000, cap);
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^```json\s*/gim, "")
    .replace(/^```\s*/gim, "")
    .replace(/```\s*$/gim, "")
    .trim();
}

function isRateLimit(err: any): boolean {
  const m = String(err?.message ?? "");
  return (
    m.includes("429") ||
    m.includes("quota") ||
    m.includes("RESOURCE_EXHAUSTED") ||
    m.includes("rate limit")
  );
}

// ─── generateText ─────────────────────────────────────────────────────────────
//
//  Geriye dönük uyumlu: eski ajanlar generateText(prompt, true/false) kullanmaya devam edebilir.
//  Yeni ajanlar: generateText(prompt, { tier: "balanced", taskName: "Copywriter" })
//
export async function generateText(
  prompt: string,
  optionsOrIsJson?: LLMOptions & { isJson?: boolean } | boolean
): Promise<string> {
  const opts: LLMOptions & { isJson?: boolean } =
    typeof optionsOrIsJson === "boolean"
      ? { isJson: optionsOrIsJson }
      : (optionsOrIsJson ?? {});

  const { tier = "premium", taskName = "?", isJson = false } = opts;

  // Primary model deneme zinciri
  const result = await _attemptGenerate(prompt, tier, taskName, isJson, opts);
  if (result.ok) return result.text;

  // Rate limit ise fallback model dene
  if (result.wasRateLimit && FALLBACK_TIER[tier]) {
    const fallback = FALLBACK_TIER[tier]!;
    console.warn(
      `[LLM:${taskName}] ${MODEL_IDS[tier]} rate limit — ${MODEL_IDS[fallback]} ile devam ediliyor.`
    );
    const fallbackResult = await _attemptGenerate(prompt, fallback, taskName, isJson, opts);
    if (fallbackResult.ok) return fallbackResult.text;
    throw new Error(
      `[LLM:${taskName}] Fallback (${MODEL_IDS[fallback]}) de başarısız: ${fallbackResult.lastError?.message}`
    );
  }

  throw new Error(
    `[LLM:${taskName}] ${MODEL_IDS[tier]} başarısız: ${result.lastError?.message}`
  );
}

async function _attemptGenerate(
  prompt: string,
  tier: ModelTier,
  taskName: string,
  isJson: boolean,
  opts?: LLMOptions,
): Promise<{ ok: true; text: string } | { ok: false; wasRateLimit: boolean; lastError: Error | null }> {
  const maxRetries = 4;
  let lastError: Error | null = null;
  let wasRateLimit = false;
  const lf = getLangfuse();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const generation = lf?.generation({
      traceId: opts?.traceId,
      name: taskName,
      model: MODEL_IDS[tier],
      input: prompt.slice(0, 2000),
      metadata: { tier, attempt },
    });

    try {
      // Gemini native structured output (responseMimeType / responseSchema).
      // İkisi de yoksa config gönderme → eski davranış birebir korunur.
      const config =
        opts?.responseMimeType || opts?.responseSchema
          ? {
              ...(opts.responseMimeType ? { responseMimeType: opts.responseMimeType } : {}),
              ...(opts.responseSchema ? { responseSchema: opts.responseSchema } : {}),
            }
          : undefined;

      const response = await getClient().models.generateContent({
        model: MODEL_IDS[tier],
        contents: prompt,
        ...(config ? { config } : {}),
      });

      const text = response.text ?? "";

      // Token kullanımı — Langfuse + onUsage callback (maliyet izleme)
      const um: any = (response as any).usageMetadata ?? {};
      const usage: TokenUsage = {
        input:  um.promptTokenCount ?? 0,
        output: um.candidatesTokenCount ?? 0,
        total:  um.totalTokenCount ?? ((um.promptTokenCount ?? 0) + (um.candidatesTokenCount ?? 0)),
      };

      if (!text) {
        lastError = new Error("Model boş yanıt döndürdü.");
        console.warn(`[LLM:${taskName}] Deneme ${attempt}: boş yanıt (${MODEL_IDS[tier]}).`);
        generation?.end({ output: "", level: "WARNING", statusMessage: "Boş yanıt" });
        break;
      }

      const out = isJson ? stripMarkdown(text) : text;
      generation?.end({
        output: out.slice(0, 2000),
        usage: { input: usage.input, output: usage.output, total: usage.total, unit: "TOKENS" },
      });
      if (usage.total > 0) opts?.onUsage?.(usage);
      return { ok: true, text: out };

    } catch (err: any) {
      lastError = err;
      generation?.end({ level: "ERROR", statusMessage: err.message });
      console.error(
        `[LLM:${taskName}] Deneme ${attempt}/${maxRetries} BAŞARISIZ (${MODEL_IDS[tier]}): ${err.message}`
      );

      if (isRateLimit(err)) {
        wasRateLimit = true;
        if (attempt < maxRetries) {
          const wait = jitteredBackoff(attempt);
          console.log(`[LLM:${taskName}] Rate limit — ${(wait / 1000).toFixed(1)}s bekleniyor...`);
          await sleep(wait);
          continue;
        }
      }

      break;
    }
  }

  return { ok: false, wasRateLimit, lastError };
}

// ─── generateJSON<T> ─────────────────────────────────────────────────────────
//
//  Type-safe JSON üretimi + Zod şema validasyonu.
//  Parse başarısız → modeli zorunlu JSON moduyla tekrar çağır.
//
export async function generateJSON<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  options: LLMOptions = {}
): Promise<T> {
  const { taskName = "?" } = options;

  // Native structured output'u varsayılan aç: model markdown sarmalamadan saf
  // JSON döndürür. Çağıran responseMimeType vermişse ona saygı duy.
  const jsonOptions: LLMOptions & { isJson?: boolean } = {
    ...options,
    isJson: true,
    responseMimeType: options.responseMimeType ?? "application/json",
  };

  // 1. Normal deneme (native JSON modu)
  const raw1 = await generateText(prompt, jsonOptions);
  const res1 = parseAndValidate(raw1, schema);
  if (res1.ok) return res1.data;

  console.warn(
    `[LLM:${taskName}] JSON parse/validasyon başarısız (deneme 1): ${res1.error}`
  );

  // 2. Model zorunlu JSON modunda + ek metin talimatı
  const strictPrompt = `${prompt}

KRİTİK KURAL: Yanıtın SADECE geçerli JSON olmalı.
- Başında veya sonunda Markdown, açıklama, yorum YASAK.
- İlk karakter { veya [ OLMAK ZORUNDA.
- Son karakter } veya ] OLMAK ZORUNDA.`;

  const raw2 = await generateText(strictPrompt, jsonOptions);
  const res2 = parseAndValidate(raw2, schema);
  if (res2.ok) return res2.data;

  throw new Error(
    `[LLM:${taskName}] 2 denemede de geçerli JSON üretilemedi.\n` +
    `Deneme 1: ${res1.error}\nDeneme 2: ${res2.error}`
  );
}

// ─── generateTextWithVision ──────────────────────────────────────────────────
//
//  Görselleri base64'e çevirip Gemini Vision ile analiz eder.
//  imageUrls: public HTTP URL listesi (max 5)
//
//  ⚠️ GÜVENLİK: Bu URL'ler DIŞ KONTROLLÜ. VisualInspiration ajanı, Firecrawl ile
//  çekilen 3. taraf sayfalardan (Pinterest/Behance/Dribbble) LLM'e URL listesi
//  çıkartıyor; saldırgan bu sayfalara içerik enjekte edip sunucuya iç ağ isteği
//  attırabilir. Bu yüzden ham fetch DEĞİL, safeFetch kullanılır: özel/rezerve IP
//  aralıklarını (169.254.169.254 metadata, 127.0.0.1, 10.x, ULA IPv6 ...),
//  yerel hostname'leri, DNS rebinding'i ve redirect ile bypass'ı engeller.
//
export async function generateTextWithVision(
  prompt: string,
  imageUrls: string[],
  options: LLMOptions = {},
): Promise<string> {
  const { tier = "balanced", taskName = "Vision" } = options;
  const maxRetries = 3;
  let lastError: Error | null = null;

  // Görselleri indir ve base64'e çevir
  const imageParts: { inlineData: { mimeType: string; data: string } }[] = [];
  for (const url of imageUrls.slice(0, 5)) {
    try {
      // safeFetch SSRF doğrulaması yapar (iç IP / metadata / redirect bypass engellenir).
      // Mevcut 10 sn'lik timeout davranışı korunuyor.
      const res  = await safeFetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) continue;
      const mime = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
      // Boyut sınırı ŞART: safeFetch NEREYE bağlanıldığını denetler, NE KADAR
      // indirildiğini değil. Sınırsız arrayBuffer() ile dış kontrollü bir URL
      // devasa yanıt döndürüp süreci şişirebilirdi. 8 MB bir sosyal medya
      // görseli için fazlasıyla yeterli; aşan görsel aşağıdaki catch'e düşüp
      // sessizce atlanır.
      const buf = await readLimited(res, MAX_VISION_IMAGE_BYTES);
      imageParts.push({ inlineData: { mimeType: mime, data: buf.toString("base64") } });
    } catch (err: any) {
      // Tek bir görselin inememesi pipeline'ı çökertmemeli — sessizce atlanır.
      // Ama engellenen/başarısız URL'ler görünmez kalmasın: URL'in tamamını
      // değil sadece host'unu logla (log enjeksiyonu / gürültü riskini azaltır).
      let host = "bilinmeyen-host";
      try { host = new URL(url).hostname; } catch { /* URL parse edilemedi */ }
      console.warn(`[LLM:${taskName}] Görsel atlandı (${host}): ${err?.message ?? "bilinmeyen hata"}`);
    }
  }

  if (imageParts.length === 0) throw new Error("Hiçbir görsel indirilemedi.");

  const contents = [
    {
      role: "user",
      parts: [
        ...imageParts,
        { text: prompt },
      ],
    },
  ];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await getClient().models.generateContent({
        model: MODEL_IDS[tier],
        contents: contents as any,
      });
      const text = response.text ?? "";
      if (!text) { lastError = new Error("Model boş yanıt döndürdü."); break; }
      return text;
    } catch (err: any) {
      lastError = err;
      if (isRateLimit(err) && attempt < maxRetries) {
        const wait = jitteredBackoff(attempt);
        console.log(`[LLM:${taskName}] Rate limit — ${(wait / 1000).toFixed(1)}s bekleniyor...`);
        await sleep(wait);
        continue;
      }
      break;
    }
  }

  throw new Error(`[LLM:${taskName}] Vision ${maxRetries} denemede başarısız: ${lastError?.message}`);
}

// ─── Zod doğrulama yardımcısı ─────────────────────────────────────────────────

type ParseResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string };

function parseAndValidate<T>(
  text: string,
  schema: z.ZodSchema<T>
): ParseResult<T> {
  let json: unknown;

  try {
    json = JSON.parse(text);
  } catch (e: any) {
    return { ok: false, error: `JSON.parse hatası: ${e.message}` };
  }

  const result = schema.safeParse(json);
  if (result.success) return { ok: true, data: result.data };

  const errors = result.error.issues
    .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
    .join(" | ");

  return { ok: false, error: errors };
}
