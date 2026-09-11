import { generateText } from "../llm";
import prisma from "../db";
import { cleanAgentError } from "../agentError";

const AGENT_NAME = "Archivist (Arşivci)";

export class ArchivistAgent {
  async execute(planId: number): Promise<boolean> {
    try {
      const plan = await prisma.monthlyPlan.findUnique({
        where: { id: planId },
        include: {
          brand: true,
          posts: {
            select: {
              topic: true,
              caption: true,
              hashtags: true,
              status: true,
              qualityScore: true,
              platform: true,
              revisionNotes: true,
              metrics: true,
            },
          },
        },
      });

      if (!plan) return false;

      await this.log(planId, "Aylık arşivleme başlatıldı...");

      const posts     = plan.posts;
      const total     = posts.length;
      const approved  = posts.filter((p) => ["approved", "published", "client_review"].includes(p.status)).length;
      const published = posts.filter((p) => p.status === "published").length;
      const rejected  = posts.filter((p) => p.status === "needs_human_intervention").length;
      const revised   = posts.filter((p) => p.revisionNotes).length;
      const avgQuality = total > 0
        ? Math.round(posts.reduce((s, p) => s + (p.qualityScore ?? 0), 0) / total)
        : 0;

      const topPerforming = posts
        .filter((p) => p.metrics)
        .sort((a, b) =>
          ((b.metrics?.likes ?? 0) + (b.metrics?.comments ?? 0)) -
          ((a.metrics?.likes ?? 0) + (a.metrics?.comments ?? 0))
        )
        .slice(0, 3)
        .map((p) => p.topic);

      const postSummary = posts
        .slice(0, 20)
        .map((p) =>
          `- "${p.topic}" | status:${p.status} | score:${p.qualityScore ?? "?"} ${p.revisionNotes ? "| revize edildi" : ""}`,
        )
        .join("\n");

      const prompt = `Sen bir içerik arşivci ajanısın. Bu ayın içerik planını analiz et ve bir sonraki ay için net öğrenimler çıkar.

MARKA: ${plan.brand.name}
AY: ${plan.month}/${plan.year}
TOPLAM İÇERİK: ${total}
ONAYLANAN: ${approved} (${total > 0 ? Math.round((approved / total) * 100) : 0}%)
YAYINLANAN: ${published}
REVİZE EDİLEN: ${revised}
REDDEDİLEN/MÜDAHALE: ${rejected}
ORT. KALİTE SKORU: ${avgQuality}/100
${topPerforming.length > 0 ? `\nEN İYİ PERFORMANS GÖSTERENLER: ${topPerforming.join(", ")}` : ""}

İÇERİK LİSTESİ:
${postSummary}

Aşağıdaki JSON formatında Türkçe analiz yaz:
{
  "topFormats": ["Bu ay en iyi çalışan format/yaklaşım 1", "Format 2", "Format 3"],
  "failedApproaches": ["İşe yaramayan/revize edilen yaklaşım 1", "Yaklaşım 2"],
  "audienceInsights": ["Hedef kitle hakkında bu aydan çıkan içgörü 1", "İçgörü 2"],
  "nextMonthPriorities": ["Bir sonraki ay mutlaka yapılması gereken şey 1", "Şey 2", "Şey 3"],
  "creativeNotes": "Bu ayın genel yaratıcı değerlendirmesi — tek paragraf",
  "stats": {
    "total": ${total},
    "approved": ${approved},
    "published": ${published},
    "rejected": ${rejected},
    "avgQuality": ${avgQuality}
  }
}

SADECE JSON dön.`;

      const raw = await generateText(prompt, { tier: "balanced", taskName: AGENT_NAME });

      let learnings: string;
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          JSON.parse(jsonMatch[0]);
          learnings = jsonMatch[0];
        } else {
          learnings = raw;
        }
      } catch {
        learnings = raw;
      }

      const existing = await prisma.brandMemory.findFirst({
        where: { brandId: plan.brandId, month: plan.month, year: plan.year },
      });

      if (existing) {
        await prisma.brandMemory.update({ where: { id: existing.id }, data: { learnings } });
      } else {
        await prisma.brandMemory.create({
          data: { brandId: plan.brandId, month: plan.month, year: plan.year, learnings },
        });
      }

      await this.log(planId, `Arşivleme tamamlandı. ${total} gönderi analiz edildi — hafıza güncellendi.`);
      return true;

    } catch (err: any) {
      await this.log(planId, `BAŞARISIZ: ${cleanAgentError(err)}`);
      return false;
    }
  }

  private async log(planId: number, action: string): Promise<void> {
    await prisma.agentLog.create({
      data: { agentName: AGENT_NAME, action, targetType: "Plan", targetId: planId },
    });
  }
}
