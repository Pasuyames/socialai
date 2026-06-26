import prisma from "../db";
import {
  scrapeProductCatalog,
  curateCatalog,
  type ProductInfo,
} from "../scrapers/ProductCatalog";

// ─── Product Curator (Ürün Küratörü) ──────────────────────────────────────────
//
// Markanın web sitesindeki ürün kataloğunu senkronize eder:
//   1. Sitemap + JSON-LD'den güncel ürün listesini çeker (isim/fiyat/paket görseli)
//   2. Daha önce hafızaya alınmış ürünleri korur
//   3. YENİ yüklenen ürünleri Gemini Vision ile analiz edip "nasıl göründüklerini"
//      (ambalaj, renkler, etiket stili, mood) marka hafızasına kaydeder
//
// Kullanım:
//   - Onboarding'de DataMiner üzerinden otomatik
//   - Yeni ürün eklendiğinde manuel/zamanlı tetikleme: new ProductCuratorAgent().execute(brandId)

export class ProductCuratorAgent {
  private agentName = "Product Curator (Ürün Küratörü)";

  async execute(brandId: number): Promise<{ success: boolean; newCount: number; total: number; error?: string }> {
    try {
      const brand = await prisma.brand.findUnique({ where: { id: brandId } });
      if (!brand) throw new Error("Marka bulunamadı.");

      // Site URL'sini brand kaydından ya da daha önce çekilen veriden bul
      const url = brand.websiteUrl ?? this.urlFromScraped(brand.rawScrapedData);
      if (!url) throw new Error("Marka websitesi URL'si bulunamadı.");

      await this.log(brandId, `Ürün kataloğu senkronizasyonu başlatıldı: ${url}`);

      // Mevcut (analiz edilmiş) katalogu yükle
      const existing = this.existingCatalog(brand.rawScrapedData);

      // Güncel katalogu çek
      const fresh = await scrapeProductCatalog(url);
      if (fresh.length === 0) {
        await this.log(brandId, "UYARI: Sitede ürün bulunamadı (sitemap/JSON-LD boş).");
        return { success: false, newCount: 0, total: 0, error: "Ürün bulunamadı." };
      }

      // Yeni ürünleri tespit et + görsel analiz yap, eskileri koru
      const { catalog, newCount, analyzedCount } = await curateCatalog(
        fresh,
        existing,
        (msg) => this.log(brandId, msg),
      );

      // rawScrapedData'yı güncelle (mevcut yapıyı koru, katalogu değiştir)
      let scraped: any = {};
      try { if (brand.rawScrapedData) scraped = JSON.parse(brand.rawScrapedData); } catch { /* yeni obje */ }
      scraped.productCatalog = catalog;
      scraped.products = catalog.map(p =>
        p.price ? `${p.name} — ${p.price} ${p.currency ?? ""}`.trim() : p.name,
      );
      scraped.catalogSyncedAt = new Date().toISOString();

      await prisma.brand.update({
        where: { id: brandId },
        data: { rawScrapedData: JSON.stringify(scraped) },
      });

      await this.log(
        brandId,
        `Senkronizasyon tamamlandı: ${catalog.length} ürün (${newCount} yeni, ${analyzedCount} görsel analiz edildi).`,
      );

      return { success: true, newCount, total: catalog.length };

    } catch (err: any) {
      await this.log(brandId, `BAŞARISIZ: ${err.message}`);
      return { success: false, newCount: 0, total: 0, error: err.message };
    }
  }

  // ─── Yardımcılar ────────────────────────────────────────────────────────────

  private existingCatalog(rawScrapedData: string | null): ProductInfo[] {
    if (!rawScrapedData) return [];
    try {
      const parsed = JSON.parse(rawScrapedData);
      return Array.isArray(parsed.productCatalog) ? parsed.productCatalog : [];
    } catch {
      return [];
    }
  }

  private urlFromScraped(rawScrapedData: string | null): string | null {
    if (!rawScrapedData) return null;
    try {
      const parsed = JSON.parse(rawScrapedData);
      return typeof parsed.url === "string" ? parsed.url : null;
    } catch {
      return null;
    }
  }

  private async log(brandId: number, action: string): Promise<void> {
    await prisma.agentLog.create({
      data: { agentName: this.agentName, action, targetType: "Brand", targetId: brandId },
    });
  }
}
