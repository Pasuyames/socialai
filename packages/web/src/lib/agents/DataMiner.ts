import * as cheerio from "cheerio";
import { chromium } from "playwright";
import prisma from "../db";
import { scrapeProductCatalog, curateCatalog, type ProductInfo } from "../scrapers/ProductCatalog";
import { assertSafeUrl, assertSafeUrlResolved, safeFetch } from "../security/ssrf";
import { cleanAgentError } from "../agentError";

export class DataMinerAgent {
  private agentName = "Data Miner (Veri Madencisi)";

  async execute(brandId: number, url: string): Promise<boolean> {
    try {
      await this.log(brandId, `Marka websitesi derin analizi başlatıldı: ${url}`);

      assertSafeUrl(url);

      // Zincir: Crawl4AI → Jina Reader (ücretsiz) → Playwright (JS rendering) → Cheerio
      const scraped = await this.scrapeWithCrawl4AI(url)
        ?? await this.scrapeWithJinaReader(url)
        ?? await this.scrapeWithPlaywright(url)
        ?? await this.scrapeWithCheerio(url);

      if (!scraped) {
        await this.log(brandId, "HATA: Site scrape edilemedi (Crawl4AI, Jina Reader, Playwright ve Cheerio hepsi başarısız).");
        return false;
      }

      // Yapılandırılmış ürün kataloğu (sitemap + JSON-LD) — keyword tahmininden
      // çok daha güvenilir. SAF METİN modu: maliyet/kota koruması için görsel
      // indirme ve Gemini Vision analizi devre dışı (yalnızca isim/fiyat/açıklama).
      const fresh = await scrapeProductCatalog(url, { images: false }).catch(() => [] as ProductInfo[]);
      if (fresh.length > 0) {
        // Mevcut (daha önce analiz edilmiş) katalogu koru; YENİ ürünlerde Vision yok
        const existingCatalog = await this.loadExistingCatalog(brandId);
        const { catalog } = await curateCatalog(
          fresh, existingCatalog, (m) => this.log(brandId, m), { analyzeImages: false },
        );
        scraped.productCatalog = catalog;
        scraped.products = catalog.map(p =>
          p.price ? `${p.name} — ${p.price} ${p.currency ?? ""}`.trim() : p.name,
        );
        scraped.catalogSyncedAt = new Date().toISOString();
      }

      await prisma.brand.update({
        where: { id: brandId },
        data: { rawScrapedData: JSON.stringify(scraped) },
      });

      await this.log(
        brandId,
        `Başarılı: ${scraped.pages.length} sayfa tarandı. ` +
        `${scraped.products?.length ?? 0} ürün (saf metin — görsel modülü devre dışı), ` +
        `${scraped.socialLinks.length} sosyal link bulundu.`
      );
      return true;

    } catch (err: any) {
      await this.log(brandId, `BAŞARISIZ: ${cleanAgentError(err)}`);
      return false;
    }
  }

  // ─── Crawl4AI microservice (ücretsiz, self-hosted) ───────────────────────────
  // CRAWL4AI_URL env yoksa veya servis çalışmıyorsa null döner → Firecrawl'a düşer

  private async scrapeWithCrawl4AI(url: string): Promise<ScrapedData | null> {
    const serviceUrl = process.env.CRAWL4AI_URL;
    if (!serviceUrl) return null;

    try {
      const res = await fetch(`${serviceUrl}/crawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, limit: 5 }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!res.ok) return null;

      const data: { pages: { url: string; title: string; content: string }[] } = await res.json();
      if (!data.pages?.length) return null;

      const combined = data.pages.map(p => p.content).join("\n\n");

      return {
        scrapedAt:   new Date().toISOString(),
        url,
        method:      "crawl4ai",
        pages:       data.pages.map(p => ({ ...p, content: p.content.slice(0, 3000) })),
        title:       data.pages[0]?.title ?? "",
        description: this.extractMeta(combined, "description"),
        products:    this.extractProducts(combined),
        socialLinks: this.extractSocialLinks(combined),
        contactInfo: this.extractContact(combined),
        instagramHandle: this.extractInstagram(combined),
        linkedinUrl:     this.extractLinkedin(combined),
      };
    } catch {
      return null;
    }
  }

  // ─── Jina Reader ile markdown çevirisi (ücretsiz) ────────────────────────────

  private async scrapeWithJinaReader(url: string): Promise<ScrapedData | null> {
    try {
      const jinaUrl = `https://r.jina.ai/${url}`;
      const res = await fetch(jinaUrl, {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) return null;

      let markdown = "";
      try {
        const json = await res.json();
        markdown = json.data?.content ?? json.content ?? "";
      } catch {
        const text = await res.text();
        markdown = text.length > 100 ? text : "";
      }

      if (!markdown || markdown.length < 100) return null;

      const $ = cheerio.load(`<pre>${markdown}</pre>`);
      const title = markdown.split("\n")[0]?.slice(0, 100) ?? "";
      const description = markdown.split("\n").find((l: string) => l.length > 50 && l.length < 200)?.slice(0, 150) ?? "";

      return {
        scrapedAt:   new Date().toISOString(),
        url,
        method:      "jina",
        pages:       [{ url, title, content: markdown.slice(0, 3000) }],
        title,
        description,
        products:    this.extractProducts(markdown),
        socialLinks: this.extractSocialLinks(markdown),
        contactInfo: this.extractContact(markdown),
        instagramHandle: this.extractInstagram(markdown),
        linkedinUrl:     this.extractLinkedin(markdown),
      };
    } catch {
      return null;
    }
  }

  // ─── Playwright ile JavaScript rendering (dinamik ürün çekme) ─────────────────

  private async scrapeWithPlaywright(url: string): Promise<ScrapedData | null> {
    let browser;
    let context;
    try {
      browser = await chromium.launch({ headless: true });
      context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        extraHTTPHeaders: { "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8" },
      });
      const page = await context.newPage();

      // SSRF: tarayıcıyı iç/özel IP'ye yönlendirmeyi engelle
      try {
        await assertSafeUrlResolved(url);
      } catch {
        return null;
      }

      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
      } catch {
        return null; // Page yüklenemedi
      }

      // Dinamik içerik yüklenmesi için scroll ve wait
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight * 5);
      });
      await page.waitForTimeout(2000);

      const html = await page.content();
      const $ = cheerio.load(html);

      const title = $("title").text().trim();
      const description = $('meta[name="description"]').attr("content")
        ?? $('meta[property="og:description"]').attr("content")
        ?? "";

      const headers: string[] = [];
      $("h1, h2, h3, h4").each((_, el) => {
        const t = $(el).text().replace(/\s+/g, " ").trim();
        if (t.length > 5 && !headers.includes(t)) headers.push(t);
      });

      // Ürün ekstraktı — Playwright sayesinde dinamik ürünler de gelir
      const products = this.extractProductsAdvanced($);

      const paragraphs: string[] = [];
      $("p, li, div[class*='desc']").each((_, el) => {
        const t = $(el).text().replace(/\s+/g, " ").trim();
        if (t.length > 40 && paragraphs.length < 30) paragraphs.push(t);
      });

      const combined = [...headers, ...products, ...paragraphs].join("\n");

      const socialLinks: string[] = [];
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href") ?? "";
        if (/instagram\.com|facebook\.com|twitter\.com|x\.com|linkedin\.com|youtube\.com|tiktok\.com/.test(href)) {
          if (!socialLinks.includes(href)) socialLinks.push(href);
        }
      });

      return {
        scrapedAt: new Date().toISOString(),
        url,
        method: "playwright",
        pages: [{ url, title, content: combined.slice(0, 3000) }],
        title,
        description,
        products,
        socialLinks,
        contactInfo: this.extractContact(combined),
        instagramHandle: this.extractInstagram(socialLinks.join("\n")),
        linkedinUrl: this.extractLinkedin(socialLinks.join("\n")),
      };
    } catch {
      return null;
    } finally {
      if (context) await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
    }
  }

  // ─── Cheerio fallback ─────────────────────────────────────────────────────────

  private async scrapeWithCheerio(url: string): Promise<ScrapedData | null> {
    try {
      const res = await safeFetch(url, {
        headers: { "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8" },
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) return null;

      const html = await res.text();
      const $    = cheerio.load(html);

      const title       = $("title").text().trim();
      const description = $('meta[name="description"]').attr("content")
        ?? $('meta[property="og:description"]').attr("content")
        ?? "";

      const headers: string[] = [];
      $("h1, h2, h3").each((_, el) => {
        const t = $(el).text().replace(/\s+/g, " ").trim();
        if (t.length > 5 && !headers.includes(t)) headers.push(t);
      });

      const paragraphs: string[] = [];
      $("p, li").each((_, el) => {
        const t = $(el).text().replace(/\s+/g, " ").trim();
        if (t.length > 40 && paragraphs.length < 30) paragraphs.push(t);
      });

      const combined = [...headers, ...paragraphs].join("\n");

      const socialLinks: string[] = [];
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href") ?? "";
        if (/instagram\.com|facebook\.com|twitter\.com|x\.com|linkedin\.com|youtube\.com|tiktok\.com/.test(href)) {
          if (!socialLinks.includes(href)) socialLinks.push(href);
        }
      });

      return {
        scrapedAt:   new Date().toISOString(),
        url,
        method:      "cheerio",
        pages:       [{ url, title, content: combined.slice(0, 3000) }],
        title,
        description,
        products:    this.extractProducts(combined),
        socialLinks,
        contactInfo: this.extractContact(combined),
        instagramHandle: this.extractInstagram(socialLinks.join("\n")),
        linkedinUrl:     this.extractLinkedin(socialLinks.join("\n")),
      };

    } catch {
      return null;
    }
  }

  // ─── Veri çıkarma yardımcıları ────────────────────────────────────────────────

  private extractMeta(text: string, _type: string): string {
    const line = text.split("\n").find(l => l.length > 50 && l.length < 200);
    return line?.trim() ?? "";
  }

  private extractProducts(text: string): string[] {
    const products: string[] = [];
    const lines = text.split("\n");
    for (const line of lines) {
      const t = line.trim();
      // Ürün/hizmet içerdiği düşünülen kısa başlıklar
      if (
        t.length > 10 && t.length < 80 &&
        /hizmet|ürün|çözüm|paket|fiyat|service|product|plan|solution|package/i.test(t) &&
        !products.includes(t)
      ) {
        products.push(t);
        if (products.length >= 10) break;
      }
    }
    return products;
  }

  private extractProductsAdvanced($: cheerio.CheerioAPI): string[] {
    const products: Set<string> = new Set();

    // Stratejı 1: Ürün container'larından
    const selectors = [
      "[data-product]",
      ".product",
      ".product-item",
      "[class*='product']",
      ".urun",
      ".item",
      "[class*='item']",
      "article",
    ];

    for (const selector of selectors) {
      $(selector).each((_, el) => {
        const $el = $(el);
        // Ad
        const name = $el.find("[class*='name'], [class*='title'], h1, h2, h3").first().text().trim();
        if (name && name.length > 5 && name.length < 100) products.add(name);

        // Başlık / Title
        const title = $el.attr("title");
        if (title && title.length > 5 && title.length < 100) products.add(title);

        // Alt text
        const alt = $el.find("img").first().attr("alt");
        if (alt && alt.length > 5 && alt.length < 100) products.add(alt);
      });
    }

    // Stratejı 2: img alt text'lerinden
    $("img[alt]").each((_, el) => {
      const alt = $(el).attr("alt") ?? "";
      if (alt.length > 5 && alt.length < 100 && !alt.toLowerCase().includes("banner")) {
        products.add(alt);
      }
    });

    // Stratejı 3: Meta/Schema.org verilerinden
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() ?? "{}");
        if (json.name) products.add(json.name);
        if (json.offers?.name) products.add(json.offers.name);
        if (Array.isArray(json.itemListElement)) {
          json.itemListElement.forEach((item: any) => {
            if (item.name) products.add(item.name);
          });
        }
      } catch {}
    });

    return Array.from(products).slice(0, 15);
  }

  private extractSocialLinks(text: string): string[] {
    const regex = /https?:\/\/(www\.)?(instagram|facebook|twitter|x|linkedin|youtube|tiktok)\.com\/[^\s)"']+/gi;
    const matches = text.match(regex) ?? [];
    return [...new Set(matches)].slice(0, 8);
  }

  private extractInstagram(text: string): string | null {
    const m = text.match(/instagram\.com\/([A-Za-z0-9_.]+)/);
    if (!m) return null;
    const handle = m[1].replace(/\/$/, "");
    return ["p", "reel", "stories", "explore"].includes(handle) ? null : `@${handle}`;
  }

  private extractLinkedin(text: string): string | null {
    const m = text.match(/linkedin\.com\/(company|in)\/([A-Za-z0-9_-]+)/);
    return m ? `https://linkedin.com/${m[1]}/${m[2]}` : null;
  }

  private extractContact(text: string): ContactInfo {
    const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = text.match(/(\+?90|0)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}/);
    return {
      email: emailMatch?.[0] ?? null,
      phone: phoneMatch?.[0]?.replace(/\s/g, "") ?? null,
    };
  }

  // Markada daha önce kaydedilmiş (analiz edilmiş) katalogu yükler — görsel
  // hafızanın korunması için. İlk onboarding'de boş döner.
  private async loadExistingCatalog(brandId: number): Promise<ProductInfo[]> {
    const row = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { rawScrapedData: true },
    });
    if (!row?.rawScrapedData) return [];
    try {
      const parsed = JSON.parse(row.rawScrapedData);
      return Array.isArray(parsed.productCatalog) ? parsed.productCatalog : [];
    } catch {
      return [];
    }
  }

  private async log(brandId: number, action: string): Promise<void> {
    await prisma.agentLog.create({
      data: { agentName: this.agentName, action, targetType: "Brand", targetId: brandId },
    });
  }
}

// ─── Tipler ───────────────────────────────────────────────────────────────────

interface PageData {
  url:     string;
  title:   string;
  content: string;
}

interface ContactInfo {
  email: string | null;
  phone: string | null;
}

interface ScrapedData {
  scrapedAt:       string;
  url:             string;
  method:          "crawl4ai" | "jina" | "playwright" | "cheerio";
  pages:           PageData[];
  title:           string;
  description:     string;
  products:        string[];
  productCatalog?: ProductInfo[];  // Yapılandırılmış katalog (isim/fiyat/görsel)
  catalogSyncedAt?: string;        // Son katalog senkronizasyon zamanı
  socialLinks:     string[];
  contactInfo:     ContactInfo;
  instagramHandle: string | null;
  linkedinUrl:     string | null;
}
