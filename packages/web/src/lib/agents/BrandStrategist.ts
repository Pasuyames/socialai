import { z } from "zod";
import { generateJSON } from "../llm";
import { cleanText, fenceUntrusted } from "../security/sanitize";
import prisma from "../db";
import { getIndustryConfig } from "../constants/industries";

// ─── Zod Şeması ───────────────────────────────────────────────────────────────

const BrandStrategySchema = z.object({
  executiveSummary: z.string(),
  positioningStatement: z.string(),
  coreValues: z.array(z.string()).min(2).max(5),
  targetAudience: z.object({
    age: z.string(),
    gender: z.string(),
    interests: z.array(z.string()).min(2),
    painPoints: z.array(z.string()).min(2),
    buyingTriggers: z.array(z.string()).min(1),
  }),
  contentPillars: z.array(z.string()).min(2).max(5),
  swotAnalysis: z.object({
    strengths:     z.array(z.string()).min(2),
    weaknesses:    z.array(z.string()).min(1),
    opportunities: z.array(z.string()).min(2),
    threats:       z.array(z.string()).min(1),
  }),
  brandArchetype: z.string(),
  competitiveEdge: z.string(),
  messagingDos: z.array(z.string()).min(2),
  messagingDonts: z.array(z.string()).min(2),
});

export type BrandStrategy = z.infer<typeof BrandStrategySchema>;

// ─── Ajan ─────────────────────────────────────────────────────────────────────

export class BrandStrategistAgent {
  private agentName = "Brand Strategist (Marka Stratejisti)";

  async execute(brandId: number): Promise<boolean> {
    try {
      const brand = await prisma.brand.findUnique({ where: { id: brandId } });

      if (!brand?.rawScrapedData) {
        await this.log(brandId, "HATA: Ham scrape verisi bulunamadı. DataMiner önce çalışmalı.");
        return false;
      }

      await this.log(brandId, "Marka stratejisi analizi başlatıldı...");

      // ScrapedData alanlarını güvenli parse et
      let scraped: any = {};
      try {
        scraped = JSON.parse(brand.rawScrapedData);
      } catch {
        await this.log(brandId, "HATA: rawScrapedData JSON parse edilemedi.");
        return false;
      }

      const industryConfig = getIndustryConfig((brand as any).industry);
      const prompt = this.buildPrompt(brand.name, scraped, industryConfig.strategyContext);

      const strategy = await generateJSON(prompt, BrandStrategySchema, {
        tier: "premium",
        taskName: this.agentName,
      });

      await prisma.brand.update({
        where: { id: brandId },
        data: { brandStrategy: JSON.stringify(strategy) },
      });

      await this.log(
        brandId,
        `Strateji tamamlandı. Arketip: ${strategy.brandArchetype.slice(0, 60)}...`
      );
      return true;

    } catch (err: any) {
      await this.log(brandId, `BAŞARISIZ: ${err.message}`);
      return false;
    }
  }

  // ─── Prompt Oluşturucu ────────────────────────────────────────────────────

  private buildPrompt(brandName: string, scraped: any, industryContext: string): string {
    // Scrape edilen tüm alanlar GÜVENİLMEYEN — temizlenir, web içeriği çitlenir
    const title       = cleanText(scraped.title ?? "", 200);
    const description = cleanText(scraped.description ?? "", 400);
    const products    = cleanText((scraped.products as string[] | undefined)?.slice(0, 10).join("\n") ?? "Bilinmiyor", 1500);
    const social      = (scraped.socialLinks as string[] | undefined)?.join(", ") ?? "Yok";
    const instagram   = cleanText(scraped.instagramHandle ?? "Yok", 100);
    const linkedin    = cleanText(scraped.linkedinUrl ?? "Yok", 200);

    // Sayfalardaki içeriği birleştir (token bütçesi: ~4000 karakter)
    const rawPageContent = (scraped.pages as any[] | undefined)
      ?.map((p: any) => `[${p.title ?? p.url}]\n${p.content ?? ""}`)
      .join("\n\n---\n\n") ?? "";
    // Güvenilmeyen web içeriği — sınırlayıcılarla çitlenir (prompt injection azaltma)
    const pageContent = rawPageContent ? fenceUntrusted(rawPageContent, "WEB_ICERIGI", 4000) : "";

    return `Sen dünyanın en seçkin üst düzey marka stratejistisin.
Aşağıdaki marka verilerini derinlemesine analiz ederek PRATİK ve AKSİYON ALINACAK bir strateji oluştur.
Klişelerden (kaliteli hizmet, müşteri odaklı vb.) kesinlikle kaçın.

SEKTÖR BAĞLAMI:
${industryContext}


MARKA ADI: ${brandName}
WEB SİTE BAŞLIĞI: ${title}
META AÇIKLAMA: ${description}
ÜRÜN / HİZMETLER:
${products}

SOSYAL MEDYA: ${social}
INSTAGRAM: ${instagram}
LİNKEDİN: ${linkedin}

WEB SİTESİ İÇERİĞİ:
${pageContent}

Aşağıdaki JSON şemasında yanıt ver. SADECE JSON dön, başka hiçbir şey yazma:

{
  "executiveSummary": "Markanın özü, vizyonu ve rakiplerinden farkını anlatan 3-4 cümlelik vurucu özet",
  "positioningStatement": "Format: [Hedef kitle] için [sunulan fayda] sağlayan tek [marka kategorisi]yiz. çünkü [kanıt]",
  "coreValues": ["Değer1", "Değer2", "Değer3"],
  "targetAudience": {
    "age": "Yaş aralığı + profil (örn: 28-45, kentli, yüksek gelirli yöneticiler)",
    "gender": "Hedef cinsiyet dağılımı ve sosyolojik gerekçesi",
    "interests": ["İlgi alanı 1", "İlgi alanı 2", "İlgi alanı 3"],
    "painPoints": ["Bu sektörde yaşanan büyük problem 1", "Problem 2", "Problem 3"],
    "buyingTriggers": ["Satın almayı tetikleyen duygu/neden 1", "Tetikleyici 2"]
  },
  "contentPillars": ["Sütun 1 (örn: Eğitim & İpuçları)", "Sütun 2", "Sütun 3"],
  "swotAnalysis": {
    "strengths": ["Güçlü yön 1", "Güçlü yön 2", "Güçlü yön 3"],
    "weaknesses": ["Zayıf yön 1", "Zayıf yön 2"],
    "opportunities": ["Fırsat 1", "Fırsat 2", "Fırsat 3"],
    "threats": ["Tehdit 1", "Tehdit 2"]
  },
  "brandArchetype": "Arketip adı + neden bu arketipin doğru seçim olduğunu anlatan 2 cümle",
  "competitiveEdge": "Bu markanın rakiplerine karşı tek ve savunulabilir rekabet avantajı — 2 cümle",
  "messagingDos": ["Sosyal medyada MUTLAKA kullanılacak dil/tema/yaklaşım 1", "Yaklaşım 2", "Yaklaşım 3"],
  "messagingDonts": ["Asla kaçınılması gereken dil/tema/yaklaşım 1", "Kaçınılacak 2", "Kaçınılacak 3"]
}`;
  }

  // ─── Yardımcılar ─────────────────────────────────────────────────────────

  private async log(brandId: number, action: string): Promise<void> {
    await prisma.agentLog.create({
      data: { agentName: this.agentName, action, targetType: "Brand", targetId: brandId },
    });
  }
}
