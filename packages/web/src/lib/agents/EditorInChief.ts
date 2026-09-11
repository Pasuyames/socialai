import { z } from "zod";
import { generateJSON } from "../llm";
import prisma from "../db";
import { POST_STATUS } from "../constants";
import { cleanAgentError } from "../agentError";

// ─── Şema ─────────────────────────────────────────────────────────────────────

const ReviewSchema = z.object({
  score:          z.number().int().min(0).max(100),
  verdict:        z.enum(["approved", "needs_rewrite"]),
  correctedCaption: z.string(),
  issues:         z.array(z.string()),
  strengths:      z.array(z.string()),
  rewriteNote:    z.string().nullish(),
});

type Review = z.infer<typeof ReviewSchema>;

// Onay için minimum skor eşiği
const APPROVAL_THRESHOLD = 72;

// ─── Ajan ─────────────────────────────────────────────────────────────────────

export class EditorInChiefAgent {
  private agentName = "Editor-in-Chief (Baş Editör / Kalite Kontrol)";

  async execute(postId: number): Promise<boolean> {
    try {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: { plan: { include: { brand: true } } },
      });

      if (!post?.caption) {
        await this.log(postId, "HATA: Denetlenecek caption bulunamadı.");
        return false;
      }

      const brand = post.plan.brand;
      await this.log(postId, "Kalite denetimi başlatıldı...");

      let tone: any = {};
      let strategy: any = {};
      try {
        if (brand.toneOfVoice)   tone     = JSON.parse(brand.toneOfVoice);
        if (brand.brandStrategy) strategy = JSON.parse(brand.brandStrategy);
      } catch { /* ignore */ }

      const prompt = this.buildPrompt(brand.name, post, tone, strategy);

      const review = await generateJSON(prompt, ReviewSchema, {
        tier: "balanced",
        taskName: this.agentName,
      });

      // Eşiği kullan: score < threshold → needs_rewrite, değil → approved
      const finalVerdict: Review["verdict"] =
        review.score >= APPROVAL_THRESHOLD ? "approved" : "needs_rewrite";

      if (finalVerdict === "approved") {
        await prisma.post.update({
          where: { id: postId },
          data: {
            caption:      review.correctedCaption,
            status:       POST_STATUS.REVIEWED,
            qualityScore: review.score,
            revisionNotes: null,
          },
        });
        await this.log(
          postId,
          `Onaylandı (skor: ${review.score}/100). ${review.issues.length > 0 ? "Küçük düzeltmeler uygulandı." : "Metin kusursuzdur."}`
        );
      } else {
        const note = [
          review.rewriteNote ?? "",
          review.issues.length > 0 ? `Sorunlar: ${review.issues.join(" | ")}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        await prisma.post.update({
          where: { id: postId },
          data: {
            status:       POST_STATUS.NEEDS_REWRITE,
            qualityScore: review.score,
            revisionNotes: note,
          },
        });
        await this.log(postId, `Yeniden yazım gerekiyor (skor: ${review.score}/100). Not: ${note.slice(0, 120)}`);
      }

      return true;

    } catch (err: any) {
      await this.log(postId, `BAŞARISIZ: ${cleanAgentError(err)}`);
      return false;
    }
  }

  // ─── Prompt ───────────────────────────────────────────────────────────────

  private buildPrompt(brandName: string, post: any, tone: any, strategy: any): string {
    const coreTone     = tone.coreTone      ?? "Belirtilmemiş";
    const dos          = (tone.dos         as string[] | undefined)?.join(", ") ?? "";
    const donts        = (tone.donts       as string[] | undefined)?.join(", ") ?? "";
    const forbidden    = (tone.forbiddenWords as string[] | undefined)?.join(", ") ?? "";
    const positioning  = strategy.positioningStatement ?? "";

    return `Sen mükemmeliyetçi bir Baş Editör (Editor-in-Chief) ajansın.
Aşağıdaki sosyal medya captionını çok yönlü bir kalite denetimiyle değerlendir.

MARKA: ${brandName}
PLATFORM: ${post.platform ?? "instagram"}
KONU: ${post.topic ?? ""}
VIRAL HOOK: ${post.hook ?? ""}

CAPTION (denetlenecek metin):
"""
${post.caption}
"""

MARKA İLETİŞİM STANDARTLARI:
- Ton: ${coreTone}
- Yapılacaklar: ${dos}
- Yapılmayacaklar: ${donts}
- Yasaklı Kelimeler: ${forbidden}
- Konumlama: ${positioning}

DEĞERLENDİRME KRİTERLERİ (toplam 100 puan):
- Ton uyumu (25p): Marka sesiyle ne kadar örtüşüyor?
- İçerik kalitesi (25p): Hook güçlü mü? Değer sunuyor mu?
- Platform uyumu (20p): Platforma uygun mu, uzunluk doğru mu?
- Dil kalitesi (15p): Dilbilgisi, akıcılık, yasaklı kelime yok mu?
- Dönüşüm potansiyeli (15p): Okuyucuyu harekete geçirir mi?

Düzeltilmiş caption: Sorun varsa düzelt, yoksa orijinali koy. Hashtag ve CTA EKLEME.

SADECE JSON dön:

{
  "score": 85,
  "verdict": "approved",
  "correctedCaption": "Düzeltilmiş veya orijinal caption metni",
  "issues": ["Varsa sorun 1", "Sorun 2"],
  "strengths": ["Güçlü yön 1", "Güçlü yön 2"],
  "rewriteNote": "needs_rewrite durumunda Copywriter'a direktif — ne yapması gerektiği"
}`;
  }

  // ─── Yardımcı ─────────────────────────────────────────────────────────────

  private async log(postId: number, action: string): Promise<void> {
    await prisma.agentLog.create({
      data: { agentName: this.agentName, action, targetType: "Post", targetId: postId },
    });
  }
}
