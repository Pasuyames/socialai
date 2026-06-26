import { z } from "zod";
import { generateJSON } from "../llm";
import prisma from "../db";
import { POST_STATUS, PLATFORM } from "../constants";

const ENGAGEMENT_SCORE_THRESHOLD = 65;
const MAX_SCORE_RETRIES = 2;

// ─── Şemalar ──────────────────────────────────────────────────────────────────

const EngagementSchema = z.object({
  cta:      z.string(),
  hashtags: z.array(z.string().regex(/^#\S+/)).min(1).max(15),
});

const EngagementScoreSchema = z.object({
  score:          z.number().int().min(0).max(100),
  hookStrength:   z.number().int().min(0).max(20),
  saveBait:       z.number().int().min(0).max(20),
  ctaClarity:     z.number().int().min(0).max(20),
  platformFit:    z.number().int().min(0).max(20),
  emotionalPull:  z.number().int().min(0).max(20),
  improvements:   z.array(z.string()).max(3),
});

// Platform bazlı hashtag sınırları
const HASHTAG_LIMITS: Record<string, { min: number; max: number; rule: string }> = {
  [PLATFORM.INSTAGRAM]: { min: 6, max: 10, rule: "3-3-3: 3 geniş sektörel, 3 niş, 3 markaya özel" },
  [PLATFORM.LINKEDIN]:  { min: 3, max: 5,  rule: "3-5 adet; profesyonel, sektör odaklı" },
  [PLATFORM.TWITTER]:   { min: 1, max: 2,  rule: "Maksimum 2 hashtag; trendlere katılım öncelikli" },
};

// ─── Ajan ─────────────────────────────────────────────────────────────────────

export class EngagementSpecialistAgent {
  private agentName = "Engagement Specialist (Etkileşim Uzmanı)";

  async execute(postId: number): Promise<boolean> {
    try {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: { plan: { include: { brand: true } } },
      });

      if (!post?.caption) {
        await this.log(postId, "HATA: Caption bulunamadı.");
        return false;
      }

      const platform = post.platform ?? PLATFORM.INSTAGRAM;
      await this.log(postId, `CTA ve hashtag analizi başlatıldı (${platform})...`);

      const brand    = post.plan.brand;
      let strategy: any = {};
      try {
        if (brand.brandStrategy) strategy = JSON.parse(brand.brandStrategy);
      } catch { /* ignore */ }

      const limits  = HASHTAG_LIMITS[platform] ?? HASHTAG_LIMITS[PLATFORM.INSTAGRAM];
      const prompt  = this.buildPrompt(brand.name, post, strategy, platform, limits);

      let result = await generateJSON(prompt, EngagementSchema, {
        tier: "fast",
        taskName: this.agentName,
      });

      // ─── Engagement Scoring Döngüsü ─────────────────────────────────────
      // DREAMS araştırmasının temel bulgusu: 5 boyutlu puanlama, 65 altıysa yeniden üret
      let bestResult   = result;
      let bestScore    = 0;
      let improvements: string[] = [];

      for (let attempt = 1; attempt <= MAX_SCORE_RETRIES; attempt++) {
        const captionPreview = `${post.caption}\n\n${result.cta}\n\n${result.hashtags.join(" ")}`;
        const scored = await this.scoreEngagement(captionPreview, platform, limits).catch(() => null);

        if (!scored) break;

        if (scored.score > bestScore) {
          bestScore  = scored.score;
          bestResult = result;
          improvements = scored.improvements;
        }

        await this.log(postId, `Etkileşim puanı (deneme ${attempt}): ${scored.score}/100`);

        if (scored.score >= ENGAGEMENT_SCORE_THRESHOLD || attempt === MAX_SCORE_RETRIES) break;

        // Eşiğin altındaysa geliştirme notlarıyla yeniden üret
        const improvePrompt = `${prompt}

ÖNCEKİ DENEME PUAN: ${scored.score}/100 — YETERSİZ.
GELİŞTİRME GEREKSİNİMLERİ:
${scored.improvements.map(i => `- ${i}`).join("\n")}

Bu sorunları gidererek daha iyi bir CTA ve hashtag seti oluştur.`;

        result = await generateJSON(improvePrompt, EngagementSchema, {
          tier: "fast",
          taskName: this.agentName,
        });
      }

      // Caption = sadece gövde metin + CTA (hashtagler ayrı alanda)
      const captionWithCta = `${post.caption}\n\n${bestResult.cta}`;
      const hashtagString  = bestResult.hashtags.join(" ");

      await prisma.post.update({
        where: { id: postId },
        data: {
          caption:  captionWithCta,
          hashtags: hashtagString,
          status:   POST_STATUS.READY_FOR_IMAGE,
        },
      });

      const scoreNote = bestScore > 0 ? ` (etkileşim puanı: ${bestScore}/100)` : "";
      await this.log(
        postId,
        `CTA eklendi. ${bestResult.hashtags.length} hashtag kaydedildi (ayrı alanda). Görsel aşamasına geçildi.${scoreNote}`
      );
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
    strategy: any,
    platform: string,
    limits: { min: number; max: number; rule: string },
  ): string {
    const interests = (strategy.targetAudience?.interests as string[] | undefined)?.join(", ") ?? "";
    const archetype = strategy.brandArchetype ?? "";

    return `Sen veri odaklı bir Growth Hacker ve Etkileşim Uzmanısın.
Bir sosyal medya captionı için platform bazlı CTA ve hashtag stratejisi oluştur.

MARKA: ${brandName}
PLATFORM: ${platform.toUpperCase()}
HEDEF İLGİ ALANLARI: ${interests || "Genel"}
ARKETIP: ${archetype}

MEVCUT CAPTION:
"""
${post.caption}
"""

HASHTAG KURALI (${platform}): ${limits.rule} — toplam ${limits.min}-${limits.max} adet

CTA KURALI:
- "Yorum yapın", "Beğenin", "Satın alın" YASAK — çok sıradan
- İnsanları kaydetmeye, tartışmaya veya arkadaş etiketlemeye iten kurnaz bir soru/tetikleyici
- Caption tonuyla aynı seste olmalı

SADECE JSON dön:

{
  "cta": "Caption'ın altına eklenecek 1-2 cümlelik vurucu CTA",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"]
}`;
  }

  // ─── Engagement Puanlayıcı ────────────────────────────────────────────────
  // DREAMS modeli ilkelerine dayalı: hook gücü, save-bait, CTA netliği,
  // platform algoritması uyumu, duygusal çekim — her biri 0-20 puan

  private async scoreEngagement(
    content: string,
    platform: string,
    limits: { min: number; max: number; rule: string },
  ): Promise<z.infer<typeof EngagementScoreSchema>> {
    const platformAlgoNote = platform === PLATFORM.INSTAGRAM
      ? "Instagram 2026: Saves ve Shares ağırlıklı, Likes ikincil."
      : platform === PLATFORM.LINKEDIN
        ? "LinkedIn 2026: Dwell Time ve Comments birincil, Like ikincil."
        : "Twitter 2026: Retweet ve Quote Tweet öncelikli.";

    const scorePrompt = `Sen sosyal medya etkileşim analisti ve büyüme uzmanısın.
Aşağıdaki caption+CTA+hashtag setini 5 boyutta puanla (her biri 0-20):

PLATFORM: ${platform.toUpperCase()}
${platformAlgoNote}

İÇERİK:
"""
${content.slice(0, 600)}
"""

PUANLAMA KRİTERLERİ:
- hookStrength (0-20): İlk cümle scroll'u durduruyor mu?
- saveBait (0-20): İçerik kaydedilmeye değer mi? (liste, formül, insight)
- ctaClarity (0-20): CTA net bir aksiyon alınmasını sağlıyor mu?
- platformFit (0-20): Platform algoritmasına uygun mu? (${platformAlgoNote})
- emotionalPull (0-20): Duygusal rezonans ve özgünlük

score = hookStrength + saveBait + ctaClarity + platformFit + emotionalPull

SADECE JSON dön:
{
  "score": <toplam 0-100>,
  "hookStrength": <0-20>,
  "saveBait": <0-20>,
  "ctaClarity": <0-20>,
  "platformFit": <0-20>,
  "emotionalPull": <0-20>,
  "improvements": ["geliştirilmesi gereken 1-3 spesifik nokta"]
}`;

    return generateJSON(scorePrompt, EngagementScoreSchema, {
      tier: "fast",
      taskName: `${this.agentName}:Scorer`,
    });
  }

  // ─── Yardımcı ─────────────────────────────────────────────────────────────

  private async log(postId: number, action: string): Promise<void> {
    await prisma.agentLog.create({
      data: { agentName: this.agentName, action, targetType: "Post", targetId: postId },
    });
  }
}
