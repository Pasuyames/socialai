import { generateText } from "../llm";
import prisma from "../db";

// Bu ajan, Orchestrator'dan gelen "soft failure" beklentisine uyar (throw yerine false döner).

const REQUIRED_FIELDS = [
  "pastPerformanceInsights",
  "currentMonthlyTrends",
  "contentFormatRecommendation",
  "viralOpportunity",
];

export class DataAnalystAgent {
  private agentName = "Data Analyst & Trend Watcher (v2.0)";

  private parseSafely(jsonString: string): any | null {
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      return null;
    }
  }

  async execute(planId: number): Promise<boolean> {
    try {
      const plan = await prisma.monthlyPlan.findUnique({
        where: { id: planId },
        include: { brand: true },
      });

      if (!plan) {
        await this.logActivity(planId, "HATA: Plan veritabanında bulunamadı.");
        return false;
      }

      if (!plan.brand.brandStrategy) {
        await this.logActivity(planId, "HATA: Marka Stratejisi bulunamadı. Analiz yapılamaz.");
        return false;
      }

      await this.logActivity(planId, "Trend Analizi ve Geçmiş Performans taraması başlatıldı (v2.0)...");

      const previousMemories = await prisma.brandMemory.findMany({
        where: { brandId: plan.brandId },
        orderBy: { createdAt: 'desc' },
        take: 3,
      });

      const hasMemories = previousMemories.length > 0;
      let pastDataText = "Henüz geçmiş aya ait marka hafızası yok. Bu ilk ay.";
      if (hasMemories) {
        pastDataText = previousMemories
          .map((m) => {
            const learnings = this.parseSafely(m.learnings) ?? m.learnings;
            const monthStr = `Ay: ${m.month}/${m.year}`;
            const learningsStr = typeof learnings === 'string' ? learnings : JSON.stringify(learnings);
            return `${monthStr} -> Öğrenilenler: ${learningsStr}`;
          })
          .join("\n");
      }

      const strategyData = this.parseSafely(plan.brand.brandStrategy);
      if (!strategyData) {
        await this.logActivity(planId, "HATA: Marka Stratejisi JSON formatında değil.");
        return false;
      }

      // Token/maliyet optimizasyonu: Stratejinin tamamı yerine özetini al
      const strategySummary = {
          summary: strategyData.executiveSummary,
          painPoints: strategyData.painPoints,
          coreValues: strategyData.coreValues,
      };

      const prompt = `
      Sen bir "Veri Analisti ve Sosyal Medya Trend Avcısı"sın.
      Görevin, bir marka için geçmiş performansı analiz etmek ve gelecek ay için trend raporu oluşturmak.

      MARKA ÖZETİ: ${JSON.stringify(strategySummary, null, 2)}
      HEDEF KİTLE YAŞ ARALIĞI: ${strategyData.targetAudience?.age || "Genel"}
      HEDEFLENEN AY/YIL: ${plan.month}/${plan.year}

      GEÇMİŞ AYLARIN HAFIZASI VE ÇIKARILAN DERSLER:
      ${pastDataText}

      Lütfen SADECE aşağıdaki JSON formatında, bu ay pazarlama direktörünün işine yarayacak ÇOK DETAYLI bir trend raporu döndür. Başka hiçbir metin ekleme.
      {
        "pastPerformanceInsights": "Geçmiş verilere bakarak bu ay kesinlikle yapmamız gereken 2 şey ve ASLA yapmamamız gereken 1 şey nedir? Somut ve aksiyon odaklı öneriler sun.",
        "currentMonthlyTrends": ["Bu ay sosyal medyada trend olan 3 adet konsept/akım (Örn: 'ASMR', 'Nostalji Pazarlaması', 'Deinfluencing'). Her birini bir cümleyle açıkla."],
        "contentFormatRecommendation": "Bu ay hangi içerik formatına ağırlık vermeliyiz? (Örn: 'Kısa Reels videoları', 'Kaydırmalı Karuseller', 'Eğitici Blog Yazıları'). Nedenini bir cümleyle belirt.",
        "viralOpportunity": "Bu ay marka için patlama (viral) potansiyeli yaratabilecek, niş ve yaratıcı 1 adet pazarlama fikri öner. (Örn: 'Rakip ürünleri inceleyen bir 'dürüst test' serisi başlatmak.')"
      }
      `;

      const llmResponse = await generateText(prompt, true);
      if (!llmResponse) {
        await this.logActivity(planId, "Trend Analizi BAŞARISIZ: LLM boş yanıt döndürdü.");
        return false;
      }
      
      const trendReportJson = this.parseSafely(llmResponse);
      if (!trendReportJson) {
        await this.logActivity(planId, `Trend Analizi BAŞARISIZ: LLM geçersiz JSON döndürdü. Çıktının ilk 200 karakteri: ${llmResponse.substring(0, 200)}`);
        return false;
      }

      for (const field of REQUIRED_FIELDS) {
        if (!trendReportJson[field]) {
          await this.logActivity(planId, `Trend Analizi BAŞARISIZ: LLM çıktısında zorunlu alan eksik: '${field}'.`);
          return false;
        }
      }

      // Meta alanları kod tarafında güvenli bir şekilde ekle
      const finalReport = {
        ...trendReportJson,
        generatedAt: new Date().toISOString(),
        planMonth: plan.month,
        planYear: plan.year,
        brandName: plan.brand.name,
      };

      await prisma.monthlyPlan.update({
        where: { id: planId },
        data: { trendReport: JSON.stringify(finalReport) },
      });

      await this.logActivity(planId, "Trend ve Veri Analizi (v2.0) tamamlandı. Rapor oluşturuldu.");
      return true;

    } catch (error: any) {
      await this.logActivity(planId, `Trend Analizi (v2.0) KRİTİK HATA: ${error.message}`);
      return false; // Orchestrator'a sürecin devam etmesi için 'false' dön
    }
  }

  private async logActivity(planId: number, action: string) {
    await prisma.agentLog.create({
      data: {
        agentName: this.agentName,
        action: action,
        targetType: "Plan",
        targetId: planId,
      },
    });
  }
}
