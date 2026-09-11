import { z } from "zod";
import { generateJSON } from "../llm";
import prisma from "../db";
import { cleanAgentError } from "../agentError";

// ─── Zod Şeması ───────────────────────────────────────────────────────────────

const DirectorBriefSchema = z.object({
  monthlyTheme: z.string(),
  focusPillars: z.array(z.string()).min(2).max(4),
  strictDirectives: z.array(z.string()).min(2).max(6),
  creativeSpark: z.string(),
  platformPriorities: z.object({
    instagram: z.string(),
    linkedin:  z.string(),
    twitter:   z.string().optional(),
  }),
  campaignNotes: z.string().optional(),
  postCountTarget: z.number().int().min(4).max(60),
});

export type DirectorBrief = z.infer<typeof DirectorBriefSchema>;

// ─── Ajan ─────────────────────────────────────────────────────────────────────

export class MarketingDirectorAgent {
  private agentName = "Marketing Director (Pazarlama Direktörü)";

  async execute(planId: number): Promise<boolean> {
    try {
      const plan = await prisma.monthlyPlan.findUnique({
        where: { id: planId },
        include: { brand: true },
      });

      if (!plan?.trendReport) {
        await this.log(planId, "HATA: Trend raporu bulunamadı. DataAnalystV2 önce çalışmalı.");
        return false;
      }

      await this.log(planId, "Aylık pazarlama briefi hazırlanıyor...");

      let strategy: any = {};
      let trendReport: any = {};
      try {
        if (plan.brand.brandStrategy) strategy = JSON.parse(plan.brand.brandStrategy);
        trendReport = JSON.parse(plan.trendReport);
      } catch {
        await this.log(planId, "HATA: Strateji veya trend raporu JSON parse edilemedi.");
        return false;
      }

      const prompt = this.buildPrompt(plan, strategy, trendReport);

      const brief = await generateJSON(prompt, DirectorBriefSchema, {
        tier: "premium",
        taskName: this.agentName,
      });

      await prisma.monthlyPlan.update({
        where: { id: planId },
        data: { directorBrief: JSON.stringify(brief) },
      });

      await this.log(planId, `Brief hazır. Tema: "${brief.monthlyTheme}" — ${brief.postCountTarget} gönderi hedefi.`);
      return true;

    } catch (err: any) {
      await this.log(planId, `BAŞARISIZ: ${cleanAgentError(err)}`);
      return false;
    }
  }

  // ─── Prompt ───────────────────────────────────────────────────────────────

  private buildPrompt(plan: any, strategy: any, trendReport: any): string {
    const viralOpp  = trendReport.viralOpportunity          ?? "";
    const doItems   = (trendReport.doThisMonth    as string[] | undefined)?.join("\n- ") ?? "";
    const avoidItems = (trendReport.avoidThisMonth as string[] | undefined)?.join("\n- ") ?? "";
    const trends    = (trendReport.currentMonthlyTrends as string[] | undefined)?.join(", ") ?? "";
    const format    = trendReport.contentFormatRecommendation ?? "";
    const kpi       = JSON.stringify(trendReport.kpiTargets ?? {});
    const coreVals  = (strategy.coreValues as string[] | undefined)?.join(", ") ?? "";
    const pillars   = (strategy.contentPillars as string[] | undefined)?.join(", ") ?? "";
    const tone      = strategy.brandArchetype ?? "";

    return `Sen vizyoner, net ve direktif odaklı bir Chief Marketing Officer (CMO)'sun.
Alt ekibe — IdeationSpecialist, Copywriter ve diğer ajanlara — bu ayın stratejik rotasını çizecek bir brief hazırla.

MARKA: ${plan.brand.name}
PLAN: ${plan.month}/${plan.year}
MÜŞTERİ ÖZEL NOTLARI: ${plan.clientBrief || "Ek not yok."}

VERI ANALİSTİ RAPORU:
- Bu Ay Yapılacaklar: ${doItems || "Yok"}
- Bu Ay Kaçınılacaklar: ${avoidItems || "Yok"}
- Güncel Trendler: ${trends}
- Format Önerisi: ${format}
- Viral Fırsat: ${viralOpp}
- KPI Hedefleri: ${kpi}

MARKA DNA:
- Temel Değerler: ${coreVals}
- İçerik Sütunları: ${pillars}
- Arketip: ${tone}

SADECE JSON dön. postCountTarget bir ay için toplam gönderi sayısı (8-20 arası öner):

{
  "monthlyTheme": "Bu ayın tek cümlelik ana teması — Copywriter kafasında yankılanacak",
  "focusPillars": ["Bu ay yoğunlaşılacak sütun 1", "Sütun 2", "Sütun 3"],
  "strictDirectives": [
    "IdeationSpecialist ve Copywriter'a KESİN EMİR 1",
    "EMİR 2",
    "EMİR 3"
  ],
  "creativeSpark": "Ekibe ilham verecek, stratejik ama duygusal bir CMO mesajı — 2-3 cümle",
  "platformPriorities": {
    "instagram": "Bu ay Instagram'da ne, nasıl, ne kadar?",
    "linkedin": "Bu ay LinkedIn'de ne, nasıl, ne kadar?",
    "twitter": "Twitter/X bu ay aktif mi, yoksa odak dışında mı?"
  },
  "campaignNotes": "Varsa özel kampanya veya dönem notu (bayram, sezon, lansman vb.)",
  "postCountTarget": 16
}`;
  }

  // ─── Yardımcı ─────────────────────────────────────────────────────────────

  private async log(planId: number, action: string): Promise<void> {
    await prisma.agentLog.create({
      data: { agentName: this.agentName, action, targetType: "Plan", targetId: planId },
    });
  }
}
