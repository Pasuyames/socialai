import { z } from "zod";
import { generateJSON } from "../llm";
import prisma from "../db";
import { POST_STATUS } from "../constants";

// ─── Şema ─────────────────────────────────────────────────────────────────────

const RoutingSchema = z.object({
  targetStatus: z.enum([
    POST_STATUS.IDEATION,
    POST_STATUS.WRITING,
    POST_STATUS.REVIEWED,
    POST_STATUS.IMAGE_PROMPT_READY,
    POST_STATUS.NEEDS_REWRITE,
  ]),
  summary:      z.string(),
  urgency:      z.enum(["low", "medium", "high"]),
});

type Routing = z.infer<typeof RoutingSchema>;

// ─── Ajan ─────────────────────────────────────────────────────────────────────

export class ClientLiaisonAgent {
  private agentName = "Client Liaison (Müşteri Temsilcisi / Revizyon Yöneticisi)";

  async execute(postId: number, clientNote: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.log(postId, `Müşteri revizyon talebi alındı: "${clientNote.slice(0, 80)}"`);

      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { caption: true, topic: true, imagePrompt: true, status: true },
      });

      if (!post) {
        await this.log(postId, "HATA: Gönderi bulunamadı.");
        return { success: false, error: "Gönderi bulunamadı." };
      }

      // AI'la revizyon tipini analiz et ve doğru aşamaya yönlendir
      const routing = await this.analyzeRevision(clientNote, post);

      await prisma.post.update({
        where: { id: postId },
        data: {
          revisionNotes: `[${routing.urgency.toUpperCase()}] ${routing.summary}\n\nMüşteri notu: ${clientNote}`,
          status:        routing.targetStatus,
        },
      });

      await this.log(
        postId,
        `Revizyon yönlendirildi → "${routing.targetStatus}" (${routing.urgency} öncelik). ${routing.summary}`
      );

      return { success: true };

    } catch (err: any) {
      await this.log(postId, `BAŞARISIZ: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // ─── AI Yönlendirme ───────────────────────────────────────────────────────

  private async analyzeRevision(clientNote: string, post: any): Promise<Routing> {
    const prompt = `Sen sosyal medya ajans proje yöneticisisin. Müşteri notunu analiz et ve revizyonu doğru pipeline aşamasına yönlendir.

MÜŞTERİ NOTU:
"${clientNote}"

MEVCUT DURUM:
- Konu: ${post.topic ?? ""}
- Caption özeti: ${(post.caption ?? "").slice(0, 150)}
- Görsel prompt var mı: ${post.imagePrompt ? "Evet" : "Hayır"}
- Mevcut durum: ${post.status}

YÖNLENDIRME SEÇENEKLERİ:
- "ideation": Konu/konsept tamamen değişmeli → IdeationSpecialist'e
- "writing": Sadece metin yeniden yazılmalı → Copywriter'a
- "needs_rewrite": Metin küçük düzeltme → EditorInChief'e
- "reviewed": Sadece hashtag/CTA → EngagementSpecialist'e
- "image_prompt_ready": Sadece görsel değişmeli → PromptEngineer'a

Kural: Minimum müdahale! Sadece metin sorunuysa görsele dokunma.

SADECE JSON dön:
{
  "targetStatus": "needs_rewrite",
  "summary": "Revizyon özeti — hangi ajana ne yapacağını söyle",
  "urgency": "medium"
}`;

    try {
      return await generateJSON(prompt, RoutingSchema, {
        tier: "fast",
        taskName: this.agentName,
      });
    } catch {
      // Fallback: metni yeniden yaz
      return {
        targetStatus: POST_STATUS.NEEDS_REWRITE,
        summary:      "AI yönlendirmesi başarısız — metin revizyonuna atıldı.",
        urgency:      "medium",
      };
    }
  }

  // ─── Yardımcı ─────────────────────────────────────────────────────────────

  private async log(postId: number, action: string): Promise<void> {
    await prisma.agentLog.create({
      data: { agentName: this.agentName, action, targetType: "Post", targetId: postId },
    });
  }
}
