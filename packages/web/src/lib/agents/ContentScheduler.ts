import { z } from "zod";
import { generateJSON } from "../llm";
import prisma from "../db";

// ─── Şema ─────────────────────────────────────────────────────────────────────

const ScheduleItemSchema = z.object({
  id:     z.number().int(),
  hour:   z.number().int().min(6).max(23),
  minute: z.number().int().min(0).max(59),
  reason: z.string(),
});

const ScheduleListSchema = z.object({
  schedules: z.array(ScheduleItemSchema),
});

// Türk kullanıcılar için yüksek etkileşim saatleri (saat UTC+3)
const TZ_OFFSET_HOURS = 3;

// ─── Ajan ─────────────────────────────────────────────────────────────────────

export class ContentSchedulerAgent {
  private agentName = "Content Scheduler (İçerik Algoritma Uzmanı)";

  async execute(planId: number): Promise<boolean> {
    try {
      const plan = await prisma.monthlyPlan.findUnique({
        where: { id: planId },
        include: { brand: true, posts: true },
      });

      if (!plan || plan.posts.length === 0) {
        await this.log(planId, "HATA: Zamanlanacak gönderi bulunamadı.");
        return false;
      }

      await this.log(planId, "Hedef kitle davranışına göre optimal zaman analizi başlatıldı...");

      let strategy: any = {};
      try {
        if (plan.brand.brandStrategy) strategy = JSON.parse(plan.brand.brandStrategy);
      } catch { /* ignore */ }

      const postList = plan.posts.map((p) => ({
        id:    p.id,
        topic: p.topic ?? "",
        day:   p.scheduledAt
          ? new Date(p.scheduledAt).getUTCDate()
          : this.defaultDay(plan.month, plan.year),
      }));

      const prompt = this.buildPrompt(plan, strategy, postList);

      const { schedules } = await generateJSON(prompt, ScheduleListSchema, {
        tier: "fast",
        taskName: this.agentName,
      });

      // Çakışma önleme: her (gün, saat) çifti için min 2 saat aralık
      const usedSlots = new Set<string>();

      let scheduled = 0;
      for (const post of plan.posts) {
        const sched = schedules.find((s) => s.id === post.id);
        if (!sched) continue;

        const baseDay = post.scheduledAt
          ? new Date(post.scheduledAt).getUTCDate()
          : sched.id % new Date(plan.year, plan.month, 0).getDate() + 1;

        // Çakışmayı çöz
        let hour   = sched.hour;
        let minute = sched.minute;
        let slotKey = `${baseDay}-${hour}-${Math.floor(minute / 30) * 30}`;
        while (usedSlots.has(slotKey)) {
          hour = hour < 22 ? hour + 1 : hour - 2;
          slotKey = `${baseDay}-${hour}-${Math.floor(minute / 30) * 30}`;
        }
        usedSlots.add(slotKey);

        // UTC saatine çevir (Turkey = UTC+3)
        const utcHour = ((hour - TZ_OFFSET_HOURS) + 24) % 24;

        const newDate = post.scheduledAt
          ? new Date(post.scheduledAt)
          : new Date(Date.UTC(plan.year, plan.month - 1, baseDay));

        newDate.setUTCHours(utcHour, minute, 0, 0);

        await prisma.post.update({
          where: { id: post.id },
          data:  { scheduledAt: newDate },
        });
        scheduled++;
      }

      await this.log(planId, `${scheduled} gönderi zamanlandı. Çakışma koruması aktif.`);
      return true;

    } catch (err: any) {
      await this.log(planId, `BAŞARISIZ: ${err.message}`);
      return false;
    }
  }

  // ─── Prompt ───────────────────────────────────────────────────────────────

  private buildPrompt(plan: any, strategy: any, postList: any[]): string {
    const audience = JSON.stringify(strategy.targetAudience ?? { age: "25-45", interests: ["İş, sosyal medya"] });

    return `Sen sosyal medya algoritma uzmanısın. Her gönderi için en yüksek etkileşimi sağlayacak saati belirle.

HEDEF KİTLE: ${audience}
AY/YIL: ${plan.month}/${plan.year}
TIMEZONE: UTC+3 (Türkiye)

Psikolojik zaman dilimleri:
- 07:30-08:30: Sabah rutini (akıllı telefon kontrol)
- 12:00-13:30: Öğle arası
- 17:30-19:30: İş çıkışı / metrobüs
- 21:00-23:00: Gece yatış öncesi

GÖNDERİLER:
${JSON.stringify(postList, null, 2)}

Her gönderi için içeriğine en uygun saati seç. Aynı güne düşen postlar arasında en az 2 saat bırak.

SADECE JSON dön:
{
  "schedules": [
    {
      "id": 1,
      "hour": 18,
      "minute": 30,
      "reason": "Beyaz yakalı hedef kitle için iş çıkışı saati"
    }
  ]
}`;
  }

  // ─── Yardımcılar ──────────────────────────────────────────────────────────

  private defaultDay(month: number, year: number): number {
    return Math.min(15, new Date(year, month, 0).getDate());
  }

  private async log(planId: number, action: string): Promise<void> {
    await prisma.agentLog.create({
      data: { agentName: this.agentName, action, targetType: "Plan", targetId: planId },
    });
  }
}
