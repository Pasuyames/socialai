import { z } from "zod";
import { generateJSON } from "../llm";
import prisma from "../db";
import { POST_STATUS, PLAN_STATUS, PLATFORM } from "../constants";
import { getIndustryConfig } from "../constants/industries";
import { getPlanLimits } from "../subscription";
import { cleanAgentError } from "../agentError";

// ─── Zod Şeması ───────────────────────────────────────────────────────────────

const PostIdeaSchema = z.object({
  pillar:   z.string(),
  topic:    z.string(),
  hook:     z.string(),
  concept:  z.string(),
  platform: z.enum([PLATFORM.INSTAGRAM, PLATFORM.LINKEDIN, PLATFORM.TWITTER]).default(PLATFORM.INSTAGRAM),
  dayOfMonth: z.number().int().min(1).max(31),
});

// Liste şeması istenen adede göre kurulur. Alt sınır SABİT 4 OLAMAZ: abonelik
// kotası 4'ten az yer bıraktığında (örn. 11/12 dolu → 1 kaldı) model doğru
// şekilde 1 fikir döndürüyor, sabit min(4) ise bunu reddedip iki denemeyi de
// boşa harcayıp üretimi tamamen başarısız kılıyordu.
// Kural: 4 ve üzeri isteklerde eski güvence (en az 4) korunur; daha az istendiğinde
// alt sınır istenen adede iner.
const ideaListSchema = (wanted: number) =>
  z.object({
    posts: z.array(PostIdeaSchema).min(Math.max(1, Math.min(wanted, 4))).max(30),
  });

// ─── Ajan ─────────────────────────────────────────────────────────────────────

export class IdeationSpecialistAgent {
  private agentName = "Ideation Specialist (Fikir Üreticisi)";

  async execute(planId: number): Promise<boolean> {
    try {
      const plan = await prisma.monthlyPlan.findUnique({
        where: { id: planId },
        include: {
          brand:  { include: { organization: { select: { plan: true } } } },
          _count: { select: { posts: true } },
        },
      });

      if (!plan?.brand.brandStrategy || !plan.directorBrief) {
        await this.log(planId, "HATA: Marka stratejisi veya director brief bulunamadı.");
        return false;
      }

      await this.log(planId, "Aylık içerik fikirleri üretiliyor...");

      let strategy: any = {};
      let brief: any = {};
      try {
        strategy = JSON.parse(plan.brand.brandStrategy);
        brief    = JSON.parse(plan.directorBrief);
      } catch {
        await this.log(planId, "HATA: Strateji veya brief JSON parse edilemedi.");
        return false;
      }

      // ─── Gönderi adedi: brief hedefi × ABONELİK KOTASI ──────────────────────
      //
      // Eskiden adet yalnızca brief'ten geliyordu (clamp 4-24) ve plan kotası HİÇ
      // okunmuyordu. Canlı testte Starter planındaki (kota: 12) bir marka için
      // 16 gönderi üretildi — %33 kota aşımı, yani ücretsiz kullanım.
      // Kota, markanın SAHİBİ organizasyonun aboneliğinden okunur; yetim marka
      // fail-closed olarak en kısıtlı plan sayılır.
      const orgPlan   = plan.brand.organization?.plan ?? "starter";
      const quota     = getPlanLimits(orgPlan).maxPostsPerPlan;
      // Plan yeniden çalıştırılabilir; mevcut gönderiler kotadan düşülür.
      const remaining = Math.max(0, quota - plan._count.posts);

      if (remaining === 0) {
        await this.log(
          planId,
          `Kota dolu: ${orgPlan} planında plan başına ${quota} gönderi sınırı — yeni fikir üretilmedi.`,
        );
        return false;
      }

      const briefTarget = typeof brief.postCountTarget === "number"
        ? Math.min(Math.max(brief.postCountTarget, 4), 24)
        : 12;
      const postCount = Math.min(briefTarget, remaining);

      if (postCount < briefTarget) {
        await this.log(
          planId,
          `Brief ${briefTarget} gönderi hedefliyordu; ${orgPlan} planı kotası nedeniyle ${postCount}'e düşürüldü.`,
        );
      }

      const industryConfig = getIndustryConfig((plan.brand as any).industry);
      const prompt = this.buildPrompt(plan, strategy, brief, postCount, industryConfig.contentRules);

      const { posts: rawPosts } = await generateJSON(prompt, ideaListSchema(postCount), {
        tier: "premium",
        taskName: this.agentName,
      });

      // Modelin döndürdüğü adet PROMPT'A GÜVENİLEREK kabul edilmez: eskiden
      // döngü posts.length üzerinden dönüyordu, yani model 30 fikir üretse
      // 30'u da yazılıyordu. Kota burada zorlanır.
      const posts = rawPosts.slice(0, postCount);
      if (rawPosts.length > posts.length) {
        await this.log(
          planId,
          `Model ${rawPosts.length} fikir döndürdü; kota gereği ilk ${posts.length} tanesi alındı.`,
        );
      }

      // Gün dağılımını düzelt (max 2 post/gün, ay sınırları içinde)
      const daysInMonth = new Date(plan.year, plan.month, 0).getDate();
      const spreadDays  = this.spreadDays(posts.length, daysInMonth);

      for (let i = 0; i < posts.length; i++) {
        const idea = posts[i];
        const day  = spreadDays[i];
        const postDate = new Date(Date.UTC(plan.year, plan.month - 1, day, 9, 0, 0));

        await prisma.post.create({
          data: {
            planId:      plan.id,
            topic:       idea.topic,
            hook:        idea.hook,
            concept:     idea.concept,
            platform:    idea.platform,
            status:      POST_STATUS.IDEATION,
            scheduledAt: postDate,
          },
        });
      }

      await prisma.monthlyPlan.update({
        where: { id: planId },
        data: { status: PLAN_STATUS.IDEATION_READY },
      });

      await this.log(planId, `${posts.length} içerik fikri üretildi ve takvime eklendi.`);
      return true;

    } catch (err: any) {
      await this.log(planId, `BAŞARISIZ: ${cleanAgentError(err)}`);
      return false;
    }
  }

  // ─── Günleri Aya Yay ──────────────────────────────────────────────────────
  // Postları aya eşit aralıklarla dağıtır, tekrar eden gün olmaz.

  private spreadDays(count: number, daysInMonth: number): number[] {
    const step    = daysInMonth / count;
    const result: number[] = [];
    for (let i = 0; i < count; i++) {
      result.push(Math.max(1, Math.min(daysInMonth, Math.round(1 + i * step))));
    }
    // Çakışmaları gider
    const used = new Set<number>();
    return result.map((d) => {
      while (used.has(d)) d = d < daysInMonth ? d + 1 : d - 1;
      used.add(d);
      return d;
    });
  }

  // ─── Prompt ───────────────────────────────────────────────────────────────

  private buildPrompt(plan: any, strategy: any, brief: any, postCount: number, industryRules: string): string {
    const painPoints = (strategy.targetAudience?.painPoints as string[] | undefined)?.join(" | ") ?? "";
    const triggers   = (strategy.targetAudience?.buyingTriggers as string[] | undefined)?.join(" | ") ?? "";
    const archetype  = strategy.brandArchetype ?? "";
    const directives = (brief.strictDirectives as string[] | undefined)?.join("\n- ") ?? "";
    const pillars    = (brief.focusPillars as string[] | undefined)?.join(" | ") ?? "";

    return `Sen viral kampanyalar yaratan kıdemli bir Content Strategist'sin.
CMO'nun brifinę ve marka stratejisine tam uyarak ${postCount} adet içerik fikri üret.

MARKA: ${plan.brand.name}
AY: ${plan.month}/${plan.year}

CMO BRİFİ:
- Aylık Tema: ${brief.monthlyTheme}
- Odak Sütunları: ${pillars}
- Direktifler:
- ${directives}
- İlham: ${brief.creativeSpark}

MARKA DNA:
- Arketip: ${archetype}
- Hedef Kitle Acıları: ${painPoints}
- Satın Alma Tetikleyicileri: ${triggers}

SEKTÖR KURALLARI:
${industryRules}

GENEL KURALLAR:
- "Günaydın", "İyi haftalar", klişe motivasyon postları YASAK
- Her hook kaydırmayı durdurmalı — merak, şok, problem tespiti veya soru
- Platform dağılımı: instagram ağırlıklı; linkedin bazıları için; twitter isteğe bağlı
- dayOfMonth 1-${new Date(plan.year, plan.month, 0).getDate()} arasında olmalı

SADECE JSON dön, tam olarak ${postCount} post:

{
  "posts": [
    {
      "pillar": "İçerik sütunu adı",
      "topic": "Bu postun konusu (1-2 cümle)",
      "hook": "Kaydırmayı durduran viral açılış — 1-2 cümle, CTA içermez",
      "concept": "Görsel/video için detaylı sanatsal konsept — PromptEngineer bunu kullanacak",
      "platform": "instagram",
      "dayOfMonth": 3
    }
  ]
}`;
  }

  // ─── Yardımcı ─────────────────────────────────────────────────────────────

  private async log(planId: number, action: string): Promise<void> {
    await prisma.agentLog.create({
      data: { agentName: this.agentName, action, targetType: "Plan", targetId: planId },
    });
  }
}
