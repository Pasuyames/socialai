import { z } from "zod";
import { generateJSON } from "../llm";
import prisma from "../db";

// ─── Zod Şeması ───────────────────────────────────────────────────────────────

const TrendReportSchema = z.object({
  pastPerformanceInsights: z.string(),
  doThisMonth: z.array(z.string()).min(2).max(5),
  avoidThisMonth: z.array(z.string()).min(1).max(6),
  currentMonthlyTrends: z.array(z.string()).min(2).max(5),
  contentFormatRecommendation: z.string(),
  viralOpportunity: z.string(),
  kpiTargets: z.object({
    engagementRate: z.string(),
    reachGrowth: z.string(),
    postFrequency: z.string(),
  }),
  agentVersion: z.literal("v2.1"),
  generatedAt:  z.string(),
});

export type TrendReport = z.infer<typeof TrendReportSchema>;

// ─── Ajan ─────────────────────────────────────────────────────────────────────

export class DataAnalystV2Agent {
  private agentName = "Data Analyst & Trend Watcher (v2.1)";

  async execute(planId: number): Promise<boolean> {
    try {
      const plan = await prisma.monthlyPlan.findUnique({
        where: { id: planId },
        include: { brand: true },
      });

      if (!plan?.brand.brandStrategy) {
        await this.log(planId, "HATA: Plan veya marka stratejisi bulunamadı.");
        return false;
      }

      await this.log(planId, "Trend ve veri analizi (v2.1) başlatıldı...");

      // Geçmiş hafıza (max 3 ay)
      const memories = await prisma.brandMemory.findMany({
        where: { brandId: plan.brandId },
        orderBy: { createdAt: "desc" },
        take: 3,
      });

      const pastText = memories.length > 0
        ? memories
            .map((m) => {
              let learnings: any = m.learnings;
              try { learnings = JSON.parse(m.learnings); } catch { /* string olarak bırak */ }
              const stats = typeof learnings === "object" ? learnings.stats : null;
              const statLine = stats
                ? ` (${stats.total ?? 0} gönderi, %${stats.approved ?? 0} onay)`
                : "";
              const summary = typeof learnings === "object"
                ? [
                    ...(learnings.topFormats          ?? []),
                    ...(learnings.audienceInsights     ?? []),
                    ...(learnings.nextMonthPriorities  ?? []),
                  ].join(", ")
                : String(learnings).slice(0, 300);
              return `${m.month}/${m.year}${statLine}: ${summary}`;
            })
            .join("\n")
        : "Geçmiş ay verisi yok — ilk ay analizi yapılıyor.";

      let strategy: any = {};
      try { strategy = JSON.parse(plan.brand.brandStrategy); } catch { /* ignore */ }

      const prompt = this.buildPrompt(plan, strategy, pastText);

      const report = await generateJSON(prompt, TrendReportSchema, {
        tier: "balanced",
        taskName: this.agentName,
      });

      await prisma.monthlyPlan.update({
        where: { id: planId },
        data: { trendReport: JSON.stringify(report) },
      });

      await this.log(planId, `Trend analizi tamamlandı. Viral fırsat: "${report.viralOpportunity.slice(0, 80)}..."`);
      return true;

    } catch (err: any) {
      await this.log(planId, `BAŞARISIZ: ${err.message}`);
      return false;
    }
  }

  // ─── Prompt ───────────────────────────────────────────────────────────────

  private buildPrompt(plan: any, strategy: any, pastText: string): string {
    return `Sen sosyal medya veri analisti ve trend avcısısın. Marka için aylık performans ve trend raporu hazırla.

MARKA: ${plan.brand.name}
PLAN: ${plan.month}/${plan.year}
MÜŞTERİ NOTLARI: ${plan.clientBrief || "Ek not yok."}
İÇERİK SÜTUNLARI: ${(strategy.contentPillars ?? []).join(", ")}
HEDEF KİTLE: ${JSON.stringify(strategy.targetAudience ?? {})}

GEÇMİŞ PERFORMANS:
${pastText}

SADECE JSON dön. agentVersion alanı tam olarak "v2.1" olmalı:

{
  "pastPerformanceInsights": "Geçmiş veriden çıkarılan tek paragraflık stratejik içgörü",
  "doThisMonth": ["Bu ay kesinlikle yapılacak şey 1", "Şey 2", "Şey 3"],
  "avoidThisMonth": ["Bu ay kesinlikle kaçınılacak 1", "Kaçınılacak 2"],
  "currentMonthlyTrends": ["Şu an sosyal medyada çalışan trend 1", "Trend 2", "Trend 3"],
  "contentFormatRecommendation": "Bu ay öncelikli içerik formatı ve gerekçesi",
  "viralOpportunity": "Bu marka için bu ay viral patlama yaratabilecek 1 özgün fikir",
  "kpiTargets": {
    "engagementRate": "Hedef etkileşim oranı (Örn: %4-6)",
    "reachGrowth": "Hedef erişim büyümesi (Örn: %15)",
    "postFrequency": "Haftalık gönderi hedefi (Örn: 4-5 gönderi/hafta)"
  },
  "agentVersion": "v2.1",
  "generatedAt": "${new Date().toISOString()}"
}`;
  }

  // ─── Yardımcı ─────────────────────────────────────────────────────────────

  private async log(planId: number, action: string): Promise<void> {
    await prisma.agentLog.create({
      data: { agentName: this.agentName, action, targetType: "Plan", targetId: planId },
    });
  }
}
