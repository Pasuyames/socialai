const fs = require('fs');

const path = 'C:\\Users\\musta\\Desktop\\SocialAI\\web\\src\\lib\\agents\\Orchestrator.ts';
let content = fs.readFileSync(path, 'utf8');

// Add new imports
if (!content.includes('DataAnalystAgent')) {
  content = content.replace(
    'import { ContentSchedulerAgent } from "./ContentScheduler";',
    'import { ContentSchedulerAgent } from "./ContentScheduler";\nimport { DataAnalystAgent } from "./DataAnalyst";\nimport { MarketingDirectorAgent } from "./MarketingDirector";'
  );
}

// Replace startMonthlyPlan
const oldFunc = /static async startMonthlyPlan\(planId: number\) \{[\s\S]*?    \} catch \(error: any\) \{\n      return \{ success: false, error: error\.message \};\n    \}\n  \}/;

const newFunc = `static async startMonthlyPlan(planId: number) {
    try {
      await prisma.agentLog.create({
        data: {
          agentName: "Project Manager",
          action: "Aylık içerik planlaması ve Strateji Konseyi başlatıldı.",
          targetType: "Plan",
          targetId: planId,
        },
      });

      // 1. Veri Analisti ve Trend Avcısı
      const analyst = new DataAnalystAgent();
      const analystSuccess = await analyst.execute(planId);
      if (!analystSuccess) throw new Error("Veri Analisti başarısız oldu.");

      // 2. Pazarlama Direktörü (Yıllık/Aylık Stratejist)
      const director = new MarketingDirectorAgent();
      const dirSuccess = await director.execute(planId);
      if (!dirSuccess) throw new Error("Pazarlama Direktörü başarısız oldu.");

      // 3. Fikir Üretici (Ideation Specialist)
      const ideation = new IdeationSpecialistAgent();
      const ideaSuccess = await ideation.execute(planId);
      if (!ideaSuccess) throw new Error("Fikir Üretici başarısız oldu.");

      // 4. İçerik Planlayıcı
      const scheduler = new ContentSchedulerAgent();
      await scheduler.execute(planId);

      return { success: true };
    } catch (error: any) {
      console.error("[Orchestrator] Monthly Plan Error:", error);
      return { success: false, error: error.message };
    }
  }`;

content = content.replace(oldFunc, newFunc);
fs.writeFileSync(path, content, 'utf8');
