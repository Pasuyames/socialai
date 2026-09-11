import { z } from "zod";
import { generateJSON } from "../llm";
import prisma from "../db";
import { cleanAgentError } from "../agentError";

// ─── Zod Şeması ───────────────────────────────────────────────────────────────

const ColorPaletteSchema = z.object({
  hex:       z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  name:      z.string(),
  role:      z.string(),
  psychology: z.string(),
});

const VisualIdentitySchema = z.object({
  currentTrends: z.array(z.string()).min(3).max(5),
  colorPalettes: z.array(ColorPaletteSchema).min(3).max(6),
  recommendedStyle: z.string(),
  compositionRules: z.array(z.string()).min(2).max(5),
  negativeElements: z.array(z.string()).min(2).max(5),
  moodKeywords: z.array(z.string()).min(4).max(8),
  imagenStylePhrase: z.string(),
  platformVisualNotes: z.object({
    instagram: z.string(),
    linkedin: z.string(),
  }),
});

export type VisualIdentity = z.infer<typeof VisualIdentitySchema>;

// ─── Ajan ─────────────────────────────────────────────────────────────────────

export class VisualResearcherAgent {
  private agentName = "Visual Researcher (Görsel Araştırmacı / Sanat Yönetmeni)";

  async execute(brandId: number): Promise<boolean> {
    try {
      const brand = await prisma.brand.findUnique({ where: { id: brandId } });

      if (!brand?.brandStrategy) {
        await this.log(brandId, "HATA: Marka stratejisi bulunamadı. BrandStrategist önce çalışmalı.");
        return false;
      }

      await this.log(brandId, "Görsel kimlik ve trend analizi başlatıldı...");

      let strategy: any = {};
      let tone: any = {};
      try {
        strategy = JSON.parse(brand.brandStrategy);
        if (brand.toneOfVoice) tone = JSON.parse(brand.toneOfVoice);
      } catch {
        await this.log(brandId, "HATA: Strateji/ton JSON parse edilemedi.");
        return false;
      }

      const prompt = this.buildPrompt(brand.name, strategy, tone);

      const visual = await generateJSON(prompt, VisualIdentitySchema, {
        tier: "premium",
        taskName: this.agentName,
      });

      await prisma.brand.update({
        where: { id: brandId },
        data: { visualIdentity: JSON.stringify(visual) },
      });

      await this.log(
        brandId,
        `Görsel kimlik tamamlandı. ${visual.colorPalettes.length} renk, ${visual.currentTrends.length} trend belirlendi.`
      );
      return true;

    } catch (err: any) {
      await this.log(brandId, `BAŞARISIZ: ${cleanAgentError(err)}`);
      return false;
    }
  }

  // ─── Prompt ───────────────────────────────────────────────────────────────

  private buildPrompt(brandName: string, strategy: any, tone: any): string {
    const audience  = JSON.stringify(strategy.targetAudience ?? {});
    const archetype = strategy.brandArchetype ?? "Belirtilmemiş";
    const pillars   = (strategy.contentPillars as string[] | undefined)?.join(", ") ?? "";
    const persona   = tone.personaName ?? "";
    const coreTone  = tone.coreTone    ?? "";

    return `Sen Pentagram, Wieden+Kennedy seviyesinde bir Sanat Yönetmeni ve görsel trend analistisin.
Marka stratejisini okuyarak bu markanın Imagen AI'ya verilecek görseller de dahil TÜM dijital görseller için bir görsel anayasa oluştur.

MARKA: ${brandName}
ARKETİP: ${archetype}
HEDEF KİTLE: ${audience}
İÇERİK SÜTUNLARI: ${pillars}
${persona ? `SES PERSONASI: ${persona} — ${coreTone}` : ""}

Yalnızca JSON dön. Başka hiçbir şey yazma:

{
  "currentTrends": [
    "Şu an bu sektörde çalışan görsel trend 1 (Örn: Tekstür katmanlı minimal fotoğraf + metin overlay)",
    "Trend 2",
    "Trend 3"
  ],
  "colorPalettes": [
    {
      "hex": "#1A2B3C",
      "name": "Renk adı",
      "role": "Ana renk | Vurgu rengi | Nötr zemin",
      "psychology": "Bu rengin hedef kitlede yarattığı psikolojik etki"
    }
  ],
  "recommendedStyle": "Sanat Yönetmeni seviyesinde fotoğraf tarzı: ışık, atmosfer, kompozisyon — 2-3 cümle",
  "compositionRules": [
    "Kompozisyon kuralı 1 (Örn: Üçte bir kuralı — ürün sol alt köşe)",
    "Kural 2",
    "Kural 3"
  ],
  "negativeElements": [
    "Bu markada asla görünmemesi gereken görsel öge 1 (Örn: Stok fotoğraf kalıpları — el sıkışma, headset takan çalışan vb.)",
    "Öge 2",
    "Öge 3"
  ],
  "moodKeywords": ["mood kelime 1", "kelime 2", "kelime 3", "kelime 4", "kelime 5"],
  "imagenStylePhrase": "Imagen AI'ya verilecek global stil tanımı — İngilizce, max 80 kelime. Işık, renk, doku, kompozisyon, mood. PromptEngineer bu cümleyi doğrudan kullanacak.",
  "platformVisualNotes": {
    "instagram": "Instagram grid için format notu — kare mi, dikey mi? Grid tutarlılığı nasıl?",
    "linkedin": "LinkedIn için format notu — yatay mı, banner mı? Kurumsal ama canlı nasıl kurulur?"
  }
}`;
  }

  // ─── Yardımcı ─────────────────────────────────────────────────────────────

  private async log(brandId: number, action: string): Promise<void> {
    await prisma.agentLog.create({
      data: { agentName: this.agentName, action, targetType: "Brand", targetId: brandId },
    });
  }
}
