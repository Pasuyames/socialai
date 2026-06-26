import { generateText } from "../llm";
import prisma from "../db";
import { POST_STATUS, PLATFORM } from "../constants";
import { getIndustryConfig } from "../constants/industries";

// Platforma göre karakter/kelime limitleri
const PLATFORM_LIMITS: Record<string, { maxWords: number; structure: string }> = {
  [PLATFORM.INSTAGRAM]: {
    maxWords: 60,
    structure: "MAKS 3 SATIR. 1. satır: dikkat çeken kısa hook/tespit. 2. satır: bağlam veya fayda (1 cümle). 3. satır (opsiyonel): CTA veya soru. Boş satır kullanma. Görsel her şeyi anlatıyor — metin sadece tamamlar.",
  },
  [PLATFORM.LINKEDIN]: {
    maxWords: 180,
    structure: "İlk 2 satır kanca görevi görür (okuyucu 'daha fazla' tıklamalı). Sonra kısa paragraflar. Düşünce liderliği odaklı.",
  },
  [PLATFORM.TWITTER]: {
    maxWords: 50,
    structure: "Tek nefeste okunur, ya fikir ya soru ya cesur tespit — 280 karakter zihniyeti",
  },
};

export class CopywriterAgent {
  private agentName = "Copywriter (Metin Yazarı)";

  async execute(postId: number): Promise<boolean> {
    try {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: { plan: { include: { brand: true } } },
      });

      if (!post?.topic || !post.plan.brand.toneOfVoice) {
        await this.log(postId, "HATA: Gönderi konusu veya Tone of Voice bulunamadı.");
        return false;
      }

      const brand    = post.plan.brand;
      const platform = (post.platform ?? PLATFORM.INSTAGRAM);
      const industryConfig = getIndustryConfig((brand as any).industry);

      // Revizyon durumunu kontrol et
      const isRevision = post.status === POST_STATUS.NEEDS_REWRITE && !!post.revisionNotes;
      await this.log(postId, isRevision ? "Revizyon talebi işleniyor..." : "Caption yazımı başlatıldı...");

      let tone: any = {};
      let strategy: any = {};
      try {
        tone     = JSON.parse(brand.toneOfVoice!);
        if (brand.brandStrategy) strategy = JSON.parse(brand.brandStrategy);
      } catch {
        await this.log(postId, "HATA: Tone of Voice JSON parse edilemedi.");
        return false;
      }

      const limits = PLATFORM_LIMITS[platform] ?? PLATFORM_LIMITS[PLATFORM.INSTAGRAM];
      const platformAdaptation = tone.platformAdaptations?.[platform] ?? "";

      const prompt = this.buildPrompt(
        brand.name,
        post,
        tone,
        strategy,
        platform,
        limits,
        platformAdaptation,
        isRevision,
        industryConfig.contentRules,
        industryConfig.complianceWarnings,
      );

      const caption = await generateText(prompt, {
        tier: "balanced",
        taskName: this.agentName,
      });

      if (!caption?.trim()) {
        await this.log(postId, "HATA: Model boş caption döndürdü.");
        return false;
      }

      await prisma.post.update({
        where: { id: postId },
        data: {
          caption:       caption.trim(),
          status:        POST_STATUS.WRITING,
          revisionNotes: null,
        },
      });

      await this.log(postId, `Caption yazıldı (${caption.split(/\s+/).length} kelime, ${platform}).`);
      return true;

    } catch (err: any) {
      await this.log(postId, `BAŞARISIZ: ${err.message}`);
      return false;
    }
  }

  // ─── Prompt ───────────────────────────────────────────────────────────────

  private buildPrompt(
    brandName: string,
    post: any,
    tone: any,
    strategy: any,
    platform: string,
    limits: { maxWords: number; structure: string },
    platformAdaptation: string,
    isRevision: boolean,
    industryRules: string,
    complianceWarnings?: string,
  ): string {
    const hook         = post.hook    ?? "";
    const concept      = post.concept ?? "";
    const painPoints   = (strategy.targetAudience?.painPoints as string[] | undefined)?.join(", ") ?? "";
    const vocabulary   = (tone.vocabulary     as string[] | undefined)?.join(", ") ?? "";
    const forbidden    = (tone.forbiddenWords  as string[] | undefined)?.join(", ") ?? "";
    const dos          = (tone.dos  as string[] | undefined)?.join("\n- ") ?? "";
    const donts        = (tone.donts as string[] | undefined)?.join("\n- ") ?? "";
    const exampleCaptions = tone.exampleCaptions
      ? `\nÖRNEK CAPTIONS (bu ton ve uzunluk için referans):\n- ${tone.exampleCaptions.productHighlight}\n- ${tone.exampleCaptions.callToAction}\n- ${tone.exampleCaptions.storytelling}`
      : "";

    const revisionBlock = isRevision
      ? `\n⚠️ REVİZYON TALEBİ — EDİTÖR NOTU:\n${post.revisionNotes}\nMevcut caption:\n${post.caption}\n\nYukarıdaki talebi karşılayacak şekilde YENİDEN YAZ.\n`
      : "";

    return `Sen ${brandName} markasının Senior Copywriter'ısın.
Aşağıdaki fikri, ton kurallarına ve platform gerekliliklerine tam uyarak bir ${platform.toUpperCase()} caption'ına dönüştür.

MARKA: ${brandName}
PLATFORM: ${platform.toUpperCase()}
KONU: ${post.topic}
${hook    ? `VIRAL HOOK (kullanılabilir, birebir de alınabilir): ${hook}` : ""}
${concept ? `GÖRSEL KONSEPT (metni buna göre yaz): ${concept}` : ""}
${revisionBlock}
TON KURALLARI:
- Ana Ton: ${tone.coreTone}
- Cümle Yapısı: ${tone.sentenceStructure}
- Yapılacaklar:
- ${dos}
- Yapılmayacaklar:
- ${donts}
- Güçlü Kelimeler: ${vocabulary}
- YASAK Kelimeler: ${forbidden}
- Emoji: ${tone.emojiUsage ?? "Minimal"}
${platformAdaptation ? `\nPLATFORM ADAPTASYONU: ${platformAdaptation}` : ""}

HEDEF KİTLE ACILARI: ${painPoints || "Belirtilmemiş"}
${exampleCaptions}

SEKTÖR KURALLARI:
${industryRules}
${complianceWarnings ? `\nUYUM UYARILARI:\n${complianceWarnings}` : ""}

YAZIM KURALLARI:
- Maksimum ${limits.maxWords} kelime — KESİNLİKLE GEÇMEYECEKSİN
- Format: ${limits.structure}
- Görsel odaklı yaz: metin görseli açıklamaz, sadece duygusal/pratik değer katar
- Hashtag ve CTA YAZMA — başka bir ajan ekleyecek
- Gereksiz dolgu cümle yok ("Bu koleksiyonu keşfetmeye hazır mısınız?" gibi klişe bitişler yasak)
- Sadece gövde metni dön, başka hiçbir şey yazma`;
  }

  // ─── Yardımcı ─────────────────────────────────────────────────────────────

  private async log(postId: number, action: string): Promise<void> {
    await prisma.agentLog.create({
      data: { agentName: this.agentName, action, targetType: "Post", targetId: postId },
    });
  }
}
