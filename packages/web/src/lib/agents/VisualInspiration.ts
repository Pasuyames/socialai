import prisma from "../db";
import { generateTextWithVision } from "../llm";

const AGENT_NAME = "Visual Inspiration (Görsel İlham Uzmanı)";

// ─── Scraper Yardımcısı ───────────────────────────────────────────────────────

// Firecrawl scrape için üst sınır — kuyruğu/pipeline'ı tıkamamak adına bu süreyi
// aşan çağrı iptal edilir (env SCRAPE_TIMEOUT_MS ile ayarlanabilir).
const SCRAPE_TIMEOUT_MS = parseInt(process.env.SCRAPE_TIMEOUT_MS ?? "8000", 10);

async function scrapeImages(url: string, extractPrompt: string, count: number): Promise<string[]> {
  // Firecrawl anahtarı yoksa AĞA HİÇ ÇIKMA — boş bekleme süresini sıfırla.
  const apiKey = process.env.FIRE_CRAWL_API_KEY;
  if (!apiKey) return [];

  try {
    const FirecrawlApp = (await import("@mendable/firecrawl-js")).default;
    const app = new FirecrawlApp({ apiKey });
    // scrape'i timeout ile yarıştır — askıda kalıp worker'ı bloklamasın.
    const result: any = await Promise.race([
      (app as any).scrape(url, {
        formats: ["extract"],
        extract: {
          prompt: extractPrompt,
          schema: {
            type: "object",
            properties: { imageUrls: { type: "array", items: { type: "string" } } },
          },
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("scrape timeout")), SCRAPE_TIMEOUT_MS),
      ),
    ]);
    const urls: string[] = result?.extract?.imageUrls ?? [];
    return urls.filter((u) => u.startsWith("http")).slice(0, count);
  } catch (e: any) {
    return [];
  }
}

// ─── Platform Scraperları ─────────────────────────────────────────────────────

async function scrapePinterest(query: string, count = 4): Promise<string[]> {
  const url = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`;
  const prompt = `Pinterest search results page. Extract image URLs of the first ${count} pins. Only return URLs containing "pinimg.com" or ending with .jpg/.jpeg/.png. Return JSON: { "imageUrls": ["url1", ...] }`;
  const urls = await scrapeImages(url, prompt, count);
  if (urls.length === 0) console.warn(`[VisualInspiration] Pinterest scrape hatası: boş sonuç`);
  return urls;
}

async function scrapeBehance(query: string, count = 3): Promise<string[]> {
  const url = `https://www.behance.net/search/projects?search=${encodeURIComponent(query)}&sort=featured`;
  const prompt = `Behance search results page. Extract thumbnail image URLs of the first ${count} projects. Look for URLs containing "behance.net" or "mir-s3-cdn-cf.behance.net". Return JSON: { "imageUrls": ["url1", ...] }`;
  return scrapeImages(url, prompt, count);
}

async function scrapeDribbble(query: string, count = 3): Promise<string[]> {
  const url = `https://dribbble.com/search/${encodeURIComponent(query)}`;
  const prompt = `Dribbble search results page. Extract shot image URLs of the first ${count} designs. Look for URLs containing "cdn.dribbble.com". Return JSON: { "imageUrls": ["url1", ...] }`;
  return scrapeImages(url, prompt, count);
}

// ─── Gemini Vision ile stil analizi ──────────────────────────────────────────

async function analyzeVisualStyle(imageUrls: string[], topic: string): Promise<string> {
  const prompt = `Bu görseller Pinterest'ten alınan sosyal medya post tasarımlarıdır. Konu: "${topic}".

Bu görselleri incele ve Imagen AI'ya verilecek bir görsel prompt için şu bilgileri çıkar:
1. IŞIK: Aydınlatma tarzı (doğal, stüdyo, sinematik, vb.)
2. RENK PALETİ: Baskın renkler ve uyum
3. KOMPOZİSYON: Çerçeveleme ve bakış açısı
4. ATMOSFER: Genel his ve estetik
5. POST TASARIM STİLİ: Düz zemin, lifestyle, ürün odaklı, editorial vb.
6. IMAGEN İÇİN STİL TARİFİ: Bu Pinterest postlarından ilham alan, Imagen AI'ya verilecek 2-3 cümlelik stil tarifi

Türkçe, kısa ve net yanıt ver.`;

  return generateTextWithVision(prompt, imageUrls, {
    tier: "balanced",
    taskName: AGENT_NAME,
  });
}

// ─── Ajan ─────────────────────────────────────────────────────────────────────

export class VisualInspirationAgent {
  async execute(postId: number): Promise<boolean> {
    try {
      // Opsiyonel kapatma: görsel ilham bloklayıcı değildir; toplu üretimde
      // kuyruğu gereksiz tıkamaması için tamamen atlanabilir. Firecrawl anahtarı
      // yoksa da zaten anlamsız olduğundan atla (boş bekleme yok).
      if (process.env.VISUAL_INSPIRATION_ENABLED === "false" || !process.env.FIRE_CRAWL_API_KEY) {
        await this.log(postId, "Görsel ilham atlandı (devre dışı / Firecrawl anahtarı yok).");
        return true;
      }

      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: { plan: { include: { brand: true } } },
      });

      if (!post) return false;

      const topic    = post.topic    ?? "";
      const concept  = post.concept  ?? "";
      const industry = (post.plan.brand as any).industry ?? "general";

      // Pinterest sorgu kelimesi: konu + sektör + "post design" / "social media"
      const industryMap: Record<string, string> = {
        fashion:        "fashion outfit post",
        food:           "food photography social media",
        tech:           "tech brand social media post",
        beauty:         "beauty skincare instagram post",
        fitness:        "fitness workout instagram",
        healthcare:     "healthcare clinic social media",
        real_estate:    "real estate social media post",
        education:      "education online course post",
        hospitality:    "hotel travel instagram post",
        ecommerce:      "product photography social media",
        automotive:     "car automotive instagram",
        interior:       "interior design instagram post",
        construction:   "construction company social media",
        consulting:     "business consulting linkedin post",
        finance:        "finance fintech social media",
        law:            "law firm social media post",
        retail:         "retail store social media",
        insurance:      "insurance brand social media",
        logistics:      "logistics company post",
        events:         "event photography instagram",
        agriculture:    "agriculture farm social media",
        ngo:            "nonprofit social media post",
        media:          "media production social media",
        personal_brand: "personal brand influencer post",
        general:        "brand social media post design",
      };

      const baseQuery = industryMap[industry] ?? "social media post design";
      const query     = concept
        ? `${concept} ${baseQuery}`
        : `${topic} ${baseQuery}`;

      await this.log(postId, `Pinterest, Behance ve Dribbble'da görsel ilham aranıyor: "${query.slice(0, 60)}"`);

      const [pinterestUrls, behanceUrls, dribbbleUrls] = await Promise.all([
        scrapePinterest(query, 4),
        scrapeBehance(query, 3),
        scrapeDribbble(query, 3),
      ]);

      const urls = [...pinterestUrls, ...behanceUrls, ...dribbbleUrls];

      if (urls.length === 0) {
        // Fallback: genel sorgu ile sadece Pinterest dene
        const fallbackUrls = await scrapePinterest(baseQuery, 5);
        if (fallbackUrls.length === 0) {
          await this.log(postId, "UYARI: Hiçbir kaynaktan görsel bulunamadı — atlandı.");
          return true;
        }
        urls.push(...fallbackUrls);
      }

      await this.log(postId, `${urls.length} görsel bulundu (Pinterest: ${pinterestUrls.length}, Behance: ${behanceUrls.length}, Dribbble: ${dribbbleUrls.length}) — Gemini Vision ile analiz ediliyor...`);

      const styleAnalysis = await analyzeVisualStyle(urls, topic);

      await prisma.post.update({
        where: { id: postId },
        data: {
          inspirationUrls:  JSON.stringify(urls),
          inspirationStyle: styleAnalysis,
        },
      });

      await this.log(postId, `Görsel ilham hazır — ${urls.length} Pinterest postu analiz edildi.`);
      return true;

    } catch (err: any) {
      await this.log(postId, `BAŞARISIZ: ${err.message}`);
      return true; // bloklayıcı değil
    }
  }

  private async log(postId: number, action: string): Promise<void> {
    await prisma.agentLog.create({
      data: { agentName: AGENT_NAME, action, targetType: "Post", targetId: postId },
    });
  }
}
