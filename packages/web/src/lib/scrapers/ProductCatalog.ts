import fs from "fs";
import path from "path";
import { generateTextWithVision } from "../llm";
import { safeFetch, readLimited } from "../security/ssrf";

// Dış sitelerden indirilen gövdeler için üst sınırlar (bellek şişirme koruması).
const MAX_TEXT_BYTES  = 5 * 1024 * 1024;  // HTML / sitemap
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;  // ürün paketi görseli

// ─── Tipler ───────────────────────────────────────────────────────────────────

// Gemini Vision'ın ürün paketi hakkında çıkardığı görsel hafıza
export interface ProductVisualAnalysis {
  packaging:      string;   // "ayakta duran doypack poşet", "cam kavanoz"
  dominantColors: string[]; // ["krem beyazı", "sıcak turuncu"]
  labelStyle:     string;   // tipografi / etiket düzeni
  depicts:        string;   // ambalajdaki illüstrasyon / gösterilen gıda
  mood:           string;   // "doğal, premium, minimal"
  promptPhrase:   string;   // görsel prompt'larda kullanılabilir İngilizce ifade
}

export interface ProductInfo {
  name:           string;
  description:    string | null;
  price:          string | null;
  currency:       string | null;
  url:            string;
  imageUrl:       string | null;   // CDN'deki orijinal mockup görseli
  imageUrls:      string[];        // Tüm ürün görselleri (ön/yan/arka)
  localImagePath: string | null;   // /uploads/products/badem-unu.webp
  visualAnalysis?: ProductVisualAnalysis | null; // Gemini Vision görsel hafızası
}

interface SitemapEntry {
  url:      string;
  imageUrl: string | null;
}

const MAX_PRODUCTS  = 20;
const FETCH_TIMEOUT = 15_000;
const CONCURRENCY   = 3;

export interface CatalogScrapeOptions {
  // Görsel madenciliği (link okuma + indirme). Maliyet/kota koruması için
  // VARSAYILAN KAPALI: yalnızca saf ürün metin verisi (isim/fiyat/açıklama) çekilir.
  // İleride görsel pipeline tekrar açılırsa `images: true` geçilir.
  images?: boolean;
}

// ─── Ana Fonksiyon ────────────────────────────────────────────────────────────
// E-ticaret sitelerinden (ikas, Shopify vb.) yapılandırılmış ürün kataloğu çeker:
// 1. products.xml sitemap'inden ürün URL'leri
// 2. Her ürün sayfasının JSON-LD verisinden isim/fiyat/açıklama
// 3. (yalnızca images=true ise) paket görsellerini local'e indirir
//
// VARSAYILAN olarak SADECE METİN: görsel linkleri okunmaz, görsel indirilmez.

export async function scrapeProductCatalog(
  baseUrl: string,
  opts: CatalogScrapeOptions = {},
): Promise<ProductInfo[]> {
  const withImages = opts.images ?? false;
  const origin = new URL(baseUrl).origin;

  const entries = await fetchProductSitemap(origin, withImages);
  if (entries.length === 0) return [];

  // Ürün detaylarını paralel çek (limitli)
  const products: ProductInfo[] = [];
  const queue = entries.slice(0, MAX_PRODUCTS);
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0) {
      const entry = queue.shift();
      if (!entry) break;
      const info = await fetchProductInfo(entry, withImages).catch(() => null);
      if (info) products.push(info);
    }
  });
  await Promise.all(workers);

  // Görsel indirme — yalnızca açıkça istenirse (saf-metin modda atlanır)
  if (withImages) {
    const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
    await fs.promises.mkdir(uploadDir, { recursive: true });
    for (const p of products) {
      if (!p.imageUrl) continue;
      p.localImagePath = await downloadImage(p.imageUrl, p.url, uploadDir).catch(() => null);
    }
  }

  return products;
}

// ─── Görsel Analiz (Gemini Vision) ───────────────────────────────────────────
// Ürün paketi görselini inceleyip yapılandırılmış görsel hafıza çıkarır.

export async function analyzeProductImage(p: ProductInfo): Promise<ProductVisualAnalysis | null> {
  if (!p.imageUrl) return null;

  const prompt = `Sen bir ürün ambalaj tasarımı analistisin. Bu ürün paketi görselini incele: "${p.name}".

Aşağıdaki bilgileri çıkar ve SADECE JSON dön:
{
  "packaging": "ambalaj türü (örn: ayakta duran doypack poşet, cam kavanoz, karton kutu)",
  "dominantColors": ["baskın renk 1", "renk 2", "renk 3"],
  "labelStyle": "etiket/tipografi düzeni ve stili kısa açıklama",
  "depicts": "ambalajda gösterilen illüstrasyon, gıda görseli veya grafik öğeler",
  "mood": "genel estetik ve his (örn: doğal, premium, minimal, sıcak)",
  "promptPhrase": "bu ürünü görsel üretiminde tarif edecek kısa İngilizce ifade"
}`;

  const raw = await generateTextWithVision(prompt, [p.imageUrl], {
    tier: "fast",
    taskName: "ProductVision",
  });

  // JSON'u esnek şekilde ayıkla (model bazen ```json bloğu sarar)
  const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonStr) return null;
  try {
    const parsed = JSON.parse(jsonStr);
    return {
      packaging:      String(parsed.packaging ?? "").slice(0, 120),
      dominantColors: Array.isArray(parsed.dominantColors) ? parsed.dominantColors.slice(0, 5).map(String) : [],
      labelStyle:     String(parsed.labelStyle ?? "").slice(0, 200),
      depicts:        String(parsed.depicts ?? "").slice(0, 200),
      mood:           String(parsed.mood ?? "").slice(0, 120),
      promptPhrase:   String(parsed.promptPhrase ?? "").slice(0, 200),
    };
  } catch {
    return null;
  }
}

// ─── Katalog Harmanlama (yeni ürünleri tespit + analiz) ───────────────────────
// Taze katalogu mevcut (analiz edilmiş) katalogla birleştirir:
// - Daha önce analiz edilmiş ürünlerin görsel hafızasını korur (yeniden analiz yok)
// - YENİ ürünleri Gemini Vision ile analiz edip hafızaya kaydeder

export interface CurateOptions {
  // Gemini Vision ile yeni ürün paket görseli analizi (MALİYETLİ LLM çağrısı).
  // Maliyet/kota koruması için VARSAYILAN KAPALI. Açıkken yalnızca daha önce
  // analiz edilmemiş YENİ ürünler için Vision çağrısı yapılır.
  analyzeImages?: boolean;
}

export async function curateCatalog(
  fresh: ProductInfo[],
  existing: ProductInfo[],
  log?: (msg: string) => Promise<void>,
  opts: CurateOptions = {},
): Promise<{ catalog: ProductInfo[]; newCount: number; analyzedCount: number }> {
  const analyzeImages = opts.analyzeImages ?? false;
  const existingByUrl = new Map(existing.map(p => [p.url, p]));
  let newCount = 0;
  let analyzedCount = 0;

  for (const product of fresh) {
    const prev = existingByUrl.get(product.url);

    // Zaten analiz edilmişse hafızadan taşı — tekrar analiz etme
    if (prev?.visualAnalysis) {
      product.visualAnalysis = prev.visualAnalysis;
      continue;
    }

    // Yeni ürün sayımı (analiz açık/kapalı fark etmeksizin)
    newCount++;

    // Görsel analiz KAPALIYSA (saf-metin mod) Vision çağrısı yapma
    if (!analyzeImages) continue;

    const analysis = await analyzeProductImage(product).catch(() => null);
    if (analysis) {
      product.visualAnalysis = analysis;
      analyzedCount++;
      await log?.(`Yeni ürün analiz edildi: ${product.name} (${analysis.packaging})`);
    } else {
      await log?.(`Yeni ürün analiz edilemedi (görsel okunamadı): ${product.name}`);
    }
  }

  return { catalog: fresh, newCount, analyzedCount };
}

// ─── Marka Görsel İmzası ──────────────────────────────────────────────────────
// Tüm ürünlerin görsel analizlerinden ortak estetiği (en sık renkler, ambalaj,
// mood) özetler. Ürün eşleşmese bile her posta verilir → tutarlı feed estetiği.

export function buildVisualSignature(catalog: ProductInfo[]): string | null {
  const analyses = catalog
    .map(p => p.visualAnalysis)
    .filter((v): v is ProductVisualAnalysis => !!v);
  if (analyses.length === 0) return null;

  const freq = (items: string[]): string[] => {
    const counts = new Map<string, number>();
    for (const raw of items) {
      const key = raw.trim().toLocaleLowerCase("tr-TR");
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
  };

  const topColors   = freq(analyses.flatMap(a => a.dominantColors ?? [])).slice(0, 5);
  const topMoods    = freq(analyses.map(a => a.mood).filter(Boolean)).slice(0, 3);
  const topPackages = freq(analyses.map(a => a.packaging).filter(Boolean)).slice(0, 2);

  const parts: string[] = [];
  if (topColors.length)   parts.push(`Ortak renk paleti: ${topColors.join(", ")}`);
  if (topMoods.length)    parts.push(`Genel mood: ${topMoods.join(", ")}`);
  if (topPackages.length) parts.push(`Ambalaj dili: ${topPackages.join(" / ")}`);

  return parts.length ? parts.join(" • ") : null;
}

// ─── Ürün ↔ Post Eşleştirme ─────────────────────────────────────────────────
// Post konusu/metni ile katalog ürünlerini kelime örtüşmesine göre eşleştirir.
// Türkçe ekleri ve büyük/küçük harfi normalize eder. Eşik altında null döner.

const TR_STOPWORDS = new Set([
  "ve","ile","bir","bu","için","gr","gram","ml","adet","paket","ürün","ürünü",
  "the","and","for","with","100","yüzde","gıda",
]);

function normalize(text: string): string[] {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-zçğıöşü0-9\s]/g, " ")
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 3 && !TR_STOPWORDS.has(w));
}

export function matchProduct(
  text: string,
  catalog: ProductInfo[],
): ProductInfo | null {
  if (!catalog || catalog.length === 0) return null;

  const postWords = new Set(normalize(text));
  if (postWords.size === 0) return null;

  let best: ProductInfo | null = null;
  let bestScore = 0;

  for (const product of catalog) {
    const nameWords = normalize(product.name);
    if (nameWords.length === 0) continue;

    // Ürün adındaki kaç kelime post metninde geçiyor?
    let hits = 0;
    for (const w of nameWords) {
      if (postWords.has(w)) hits++;
    }
    // Ürün adının kapsanma oranı — kısa adlarda tam eşleşmeyi ödüllendirir
    const score = hits / nameWords.length;

    if (score > bestScore) {
      bestScore = score;
      best = product;
    }
  }

  // En az ürün adının yarısı geçmeli (örn. "Badem Unu" → "badem" + "unu")
  return bestScore >= 0.5 ? best : null;
}

// ─── Sitemap ──────────────────────────────────────────────────────────────────

async function fetchProductSitemap(origin: string, withImages: boolean): Promise<SitemapEntry[]> {
  // Önce doğrudan products.xml dene (ikas/Shopify standardı)
  let xml = await fetchText(`${origin}/products.xml`);

  // Yoksa ana sitemap'ten ürün sitemap'ini bul
  if (!xml || !xml.includes("<urlset")) {
    const index = await fetchText(`${origin}/sitemap.xml`);
    if (!index) return [];
    const sub = index.match(/<loc>([^<]*product[^<]*)<\/loc>/i)?.[1];
    if (!sub) return [];
    xml = await fetchText(sub.trim());
    if (!xml) return [];
  }

  const entries: SitemapEntry[] = [];
  const blocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
  for (const block of blocks) {
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1]?.trim();
    if (!loc) continue;
    // Saf-metin modda görsel linkleri okunmaz
    const img = withImages
      ? (block.match(/<image:loc>([^<]+)<\/image:loc>/)?.[1]?.trim() ?? null)
      : null;
    entries.push({ url: loc, imageUrl: img });
  }
  return entries;
}

// ─── Ürün Detayı (JSON-LD) ────────────────────────────────────────────────────

async function fetchProductInfo(entry: SitemapEntry, withImages: boolean): Promise<ProductInfo | null> {
  const html = await fetchText(entry.url);

  let name: string | null = null;
  let description: string | null = null;
  let price: string | null = null;
  let currency: string | null = null;
  let imageUrls: string[] = [];

  if (html) {
    const ld = extractProductJsonLd(html);
    if (ld) {
      name        = typeof ld.name === "string" ? ld.name : null;
      description = typeof ld.description === "string" ? ld.description.slice(0, 300) : null;
      // Saf-metin modda JSON-LD görsel alanları okunmaz
      if (withImages) {
        imageUrls = Array.isArray(ld.image) ? ld.image.filter((i: unknown) => typeof i === "string")
                  : typeof ld.image === "string" ? [ld.image] : [];
      }
      const offer = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
      if (offer) {
        price    = offer.price != null ? String(offer.price) : null;
        currency = typeof offer.priceCurrency === "string" ? offer.priceCurrency : null;
      }
    }
  }

  // JSON-LD yoksa slug'dan isim türet
  if (!name) {
    const slug = new URL(entry.url).pathname.split("/").filter(Boolean).pop() ?? "";
    if (!slug) return null;
    name = slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }
  if (withImages && imageUrls.length === 0 && entry.imageUrl) imageUrls = [entry.imageUrl];

  return {
    name,
    description,
    price,
    currency,
    url: entry.url,
    imageUrl: withImages ? (imageUrls[0] ?? entry.imageUrl) : null,
    imageUrls,
    localImagePath: null,
  };
}

function extractProductJsonLd(html: string): any | null {
  const regex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    try {
      const json = JSON.parse(m[1]);
      const candidates = Array.isArray(json) ? json : json["@graph"] ?? [json];
      for (const c of candidates) {
        if (c && c["@type"] === "Product") return c;
      }
    } catch { /* geçersiz JSON bloğunu atla */ }
  }
  return null;
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

async function fetchText(url: string): Promise<string | null> {
  try {
    // safeFetch SSRF doğrulaması yapar (iç IP / metadata / redirect bypass engellenir)
    const res = await safeFetch(url, {
      headers: { "Accept-Language": "tr-TR,tr;q=0.9" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!res.ok) return null;
    // Boyut sınırı: safeFetch nereye bağlanıldığını denetler, ne kadar
    // indirildiğini değil. Taranan site bizim kontrolümüzde olmadığı için
    // sınırsız okuma bellek şişirmeye açıktır. 5 MB bir HTML/sitemap için
    // fazlasıyla yeterli.
    const body = await readLimited(res, MAX_TEXT_BYTES);
    return body.toString("utf8");
  } catch {
    return null;
  }
}

// Dosya adı sanitizasyonu — path traversal / geçersiz karakter koruması
function safeFilename(slug: string, ext: string): string {
  const cleanSlug = slug.replace(/[^a-z0-9_-]/gi, "").slice(0, 80) || `urun-${Date.now()}`;
  const cleanExt  = /^\.[a-z0-9]{1,5}$/i.test(ext) ? ext.toLowerCase() : ".jpg";
  return `${cleanSlug}${cleanExt}`;
}

async function downloadImage(imageUrl: string, productUrl: string, dir: string): Promise<string | null> {
  const res = await safeFetch(imageUrl, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!res.ok) return null;

  const rawSlug = new URL(productUrl).pathname.split("/").filter(Boolean).pop() ?? `urun-${Date.now()}`;
  const rawExt  = path.extname(new URL(imageUrl).pathname) || ".jpg";
  const file    = safeFilename(rawSlug, rawExt);

  // Üst sınır: kötü niyetli/bozuk bir sunucu gigabaytlarca veri akıtabilir.
  const buffer = await readLimited(res, MAX_IMAGE_BYTES);
  if (buffer.length < 1000) return null; // bozuk/boş görsel

  // path traversal'a karşı son güvence: hedef dizin içinde kaldığını doğrula
  const target = path.resolve(dir, file);
  if (!target.startsWith(path.resolve(dir) + path.sep)) return null;

  await fs.promises.writeFile(target, buffer);
  return `/uploads/products/${file}`;
}
