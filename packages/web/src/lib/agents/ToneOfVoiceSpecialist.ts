import { z } from "zod";
import { generateJSON } from "../llm";
import prisma from "../db";

// ─── Zod Şeması ───────────────────────────────────────────────────────────────

// LLM bazen serbest-metin alanlarını ("3 sıfat" gibi) DİZİ olarak döndürür
// (örn. ["Cesur","Özgün","Sıcak"]). Bunu reddedip ajanı patlatmak yerine,
// dizi gelirse virgülle birleştirip string'e çeviririz (dayanıklı parse).
const looseString = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v.join(", ") : v));

const ToneOfVoiceSchema = z.object({
  personaName: z.string(),
  coreTone: looseString,
  sentenceStructure: looseString,
  dos: z.array(z.string()).min(3).max(6),
  donts: z.array(z.string()).min(3).max(6),
  emojiUsage: looseString,
  vocabulary: z.array(z.string()).min(4).max(8),
  forbiddenWords: z.array(z.string()).min(3).max(8),
  platformAdaptations: z.object({
    instagram: z.string(),
    linkedin: z.string(),
    twitter: z.string(),
  }),
  exampleCaptions: z.object({
    productHighlight: z.string(),
    callToAction: z.string(),
    storytelling: z.string(),
  }),
});

export type ToneOfVoice = z.infer<typeof ToneOfVoiceSchema>;

// ─── Ajan ─────────────────────────────────────────────────────────────────────

export class ToneOfVoiceSpecialistAgent {
  private agentName = "Tone of Voice Specialist (İletişim Uzmanı)";

  async execute(brandId: number): Promise<boolean> {
    try {
      const brand = await prisma.brand.findUnique({ where: { id: brandId } });

      if (!brand?.brandStrategy) {
        await this.log(brandId, "HATA: Marka stratejisi bulunamadı. BrandStrategist önce çalışmalı.");
        return false;
      }

      await this.log(brandId, "Ses tonu analizi başlatıldı...");

      let strategy: any = {};
      try {
        strategy = JSON.parse(brand.brandStrategy);
      } catch {
        await this.log(brandId, "HATA: brandStrategy JSON parse edilemedi.");
        return false;
      }

      const prompt = this.buildPrompt(brand.name, strategy);

      const tone = await generateJSON(prompt, ToneOfVoiceSchema, {
        tier: "premium",
        taskName: this.agentName,
      });

      await prisma.brand.update({
        where: { id: brandId },
        data: { toneOfVoice: JSON.stringify(tone) },
      });

      await this.log(brandId, `Ses tonu belirlendi. Persona: "${tone.personaName}" — Ton: ${tone.coreTone}`);
      return true;

    } catch (err: any) {
      await this.log(brandId, `BAŞARISIZ: ${err.message}`);
      return false;
    }
  }

  // ─── Prompt ───────────────────────────────────────────────────────────────

  private buildPrompt(brandName: string, strategy: any): string {
    const audience    = JSON.stringify(strategy.targetAudience ?? {});
    const archetype   = strategy.brandArchetype   ?? "Belirtilmemiş";
    const positioning = strategy.positioningStatement ?? "Belirtilmemiş";
    const values      = (strategy.coreValues as string[] | undefined)?.join(", ") ?? "Belirtilmemiş";
    const dos         = (strategy.messagingDos  as string[] | undefined)?.join("\n- ") ?? "";
    const donts       = (strategy.messagingDonts as string[] | undefined)?.join("\n- ") ?? "";

    return `Sen Apple, Nike, Oatly, Duolingo gibi global markaların arkasındaki Chief Brand Voice Architect ve tüketici psikologusun.
Bir marka için kullanıcıların aklına yapışan, satış psikolojisine dayalı bir İletişim Anayasası oluştur.

MARKA: ${brandName}
KONUMLandırma: ${positioning}
HEDEF KİTLE: ${audience}
ARKETİP: ${archetype}
TEMEL DEĞERLER: ${values}
${dos ? `MESAJLAŞMA YAPILACAKLAR:\n- ${dos}` : ""}
${donts ? `MESAJLAŞMA KAÇINILACAKLAR:\n- ${donts}` : ""}

Sıradan kurallar değil: psikoloji, ritim, duygusal tetikleyiciler odak.
SADECE JSON dön:

{
  "personaName": "Sesin insan hali — bir isim ver (Örn: Bilge Dost, Meydan Okuyan Uzman, Şakacı Marka)",
  "coreTone": "TEK BİR STRING (dizi DEĞİL): ana tonu yansıtan 3 sıfat virgülle (Örn: \"Cesur, Özgün, Sıcak\")",
  "sentenceStructure": "Cümle ritmi nasıl olacak? Uzun mu kısa mı? Soru kullanılacak mı? Örnek ver.",
  "dos": [
    "Kısa, nefes kesen cümleler kur — 5-8 kelime",
    "2. kural",
    "3. kural"
  ],
  "donts": [
    "Edilgen yapı kullanma (yapılmıştır, sunulmaktadır)",
    "2. kural",
    "3. kural"
  ],
  "emojiUsage": "Hangi emoji kategorileri kullanılır, hangileri bu markayı ucuz gösterir? Platform farkı var mı?",
  "vocabulary": ["Güçlü kelime 1", "Kelime 2", "Kelime 3", "Kelime 4", "Kelime 5"],
  "forbiddenWords": ["Kaçınılacak 1", "Kaçınılacak 2", "Kaçınılacak 3", "Kaçınılacak 4"],
  "platformAdaptations": {
    "instagram": "Instagram için ton farkı — görsel hikaye odaklı, kısa, duygusal nasıl yazılır?",
    "linkedin": "LinkedIn için ton farkı — profesyonel ama sıkıcı değil, otoriter ama yakın nasıl kurulur?",
    "twitter": "Twitter/X için ton farkı — cesur, tartışmacı, 140 karakter zihniyeti nasıl yansır?"
  },
  "exampleCaptions": {
    "productHighlight": "Ürün/hizmet öne çıkarma için örnek caption (max 150 karakter)",
    "callToAction": "Satış odaklı CTA örnek caption (max 100 karakter)",
    "storytelling": "Hikaye anlatımı örnek caption açılış cümlesi (max 80 karakter, merak uyandırsın)"
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
