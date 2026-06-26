import prisma from "../db";
import { DataMinerAgent }            from "./DataMiner";
import { BrandStrategistAgent }      from "./BrandStrategist";
import { ToneOfVoiceSpecialistAgent } from "./ToneOfVoiceSpecialist";
import { VisualResearcherAgent }     from "./VisualResearcher";
import { DataAnalystV2Agent }        from "./DataAnalystV2";
import { MarketingDirectorAgent }    from "./MarketingDirector";
import { IdeationSpecialistAgent }   from "./IdeationSpecialist";
import { ContentSchedulerAgent }     from "./ContentScheduler";
import { CopywriterAgent }           from "./Copywriter";
import { EditorInChiefAgent }        from "./EditorInChief";
import { EngagementSpecialistAgent } from "./EngagementSpecialist";
import { PromptEngineerAgent }       from "./PromptEngineer";
import { VisualInspirationAgent }    from "./VisualInspiration";
import { ImageGeneratorAgent }       from "./ImageGenerator";
import { VisualInspectorAgent }      from "./VisualInspector";
import { AssetManagerAgent }         from "./AssetManager";
import { ArchivistAgent }            from "./Archivist";
import { POST_STATUS, PLAN_STATUS }  from "../constants";

const PM = "Project Manager (Orkestratör)";

// Aynı anda çalışan onboarding işlemlerini takip eder (çift tetiklenme koruması)
const runningOnboardings = new Set<number>();

// ─── Yardımcı ─────────────────────────────────────────────────────────────────

async function pmLog(targetType: "Brand" | "Plan" | "Post", targetId: number, action: string) {
  await prisma.agentLog
    .create({ data: { agentName: PM, action, targetType, targetId } })
    .catch(() => {});
}

// Paralel işlem için concurrency limiti
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item !== undefined) await fn(item);
    }
  });
  await Promise.all(workers);
}

// Belirli sürede tamamlanmazsa timeout hatası fırlatır — timer leak korumalı
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`[Timeout] ${label} ${(ms / 60000).toFixed(0)} dakikada tamamlanamadı.`)),
      ms,
    );
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer!));
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export class Orchestrator {

  // ─── 1. Marka Kurulumu (Onboarding) ───────────────────────────────────────

  static async startBrandOnboarding(brandId: number, url: string): Promise<{ success: boolean; error?: string }> {
    if (runningOnboardings.has(brandId)) {
      console.warn(`[Orchestrator] Brand ${brandId} onboarding zaten çalışıyor — atlandı.`);
      return { success: false, error: "Analiz zaten devam ediyor." };
    }
    runningOnboardings.add(brandId);
    try {
      await pmLog("Brand", brandId, "Marka kurulum süreci başlatıldı.");

      // Adım 1: Veri Madencisi
      const ok1 = await new DataMinerAgent().execute(brandId, url);
      if (!ok1) throw new Error("DataMiner başarısız.");

      // Adım 2: Marka Stratejisti
      const ok2 = await new BrandStrategistAgent().execute(brandId);
      if (!ok2) throw new Error("BrandStrategist başarısız.");

      // Adım 3: Paralel — Ses Tonu + Görsel Araştırmacı (her ikisi de strateji sonrası)
      const [okTone, okVisual] = await Promise.all([
        new ToneOfVoiceSpecialistAgent().execute(brandId),
        new VisualResearcherAgent().execute(brandId),
      ]);
      if (!okTone)   throw new Error("ToneOfVoiceSpecialist başarısız.");
      if (!okVisual) throw new Error("VisualResearcher başarısız.");

      await pmLog("Brand", brandId, "Marka kurulumu tamamlandı. Tüm temel analizler hazır.");
      return { success: true };

    } catch (err: any) {
      await pmLog("Brand", brandId, `Marka kurulumu DURDURULDU: ${err.message}`);
      return { success: false, error: err.message };
    } finally {
      runningOnboardings.delete(brandId);
    }
  }

  // ─── 2. Aylık Plan Başlatma ────────────────────────────────────────────────

  static async startMonthlyPlan(planId: number): Promise<{ success: boolean; error?: string }> {
    try {
      // Çift çalışma koruması
      const plan = await prisma.monthlyPlan.findUnique({ where: { id: planId } });
      const skipStatuses: string[] = [
        PLAN_STATUS.POST_GENERATION,
        PLAN_STATUS.IMAGE_GENERATION,
        PLAN_STATUS.REVIEW,
        PLAN_STATUS.READY,
        PLAN_STATUS.ARCHIVED,
      ];
      if (plan && skipStatuses.includes(plan.status)) {
        return { success: false, error: `Plan zaten işleniyor veya tamamlandı (${plan.status}).` };
      }

      await prisma.monthlyPlan.update({ where: { id: planId }, data: { status: PLAN_STATUS.GENERATING_IDEAS } });
      await pmLog("Plan", planId, "Aylık plan süreci başlatıldı.");

      // 1. Veri Analisti (başarısız olsa da devam)
      const analystOk = await new DataAnalystV2Agent().execute(planId).catch(() => false);
      if (!analystOk) await pmLog("Plan", planId, "UYARI: DataAnalystV2 başarısız — devam ediliyor.");

      // 2. Pazarlama Direktörü (başarısız olsa da devam)
      const dirOk = await new MarketingDirectorAgent().execute(planId).catch(() => false);
      if (!dirOk) await pmLog("Plan", planId, "UYARI: MarketingDirector başarısız — devam ediliyor.");

      // 3. Fikir Üretici
      const ideaOk = await new IdeationSpecialistAgent().execute(planId);
      if (!ideaOk) {
        await prisma.monthlyPlan.update({ where: { id: planId }, data: { status: PLAN_STATUS.POST_GENERATION_FAILED } });
        throw new Error("IdeationSpecialist başarısız.");
      }

      // 4. İçerik Zamanlayıcı
      await new ContentSchedulerAgent().execute(planId);

      await pmLog("Plan", planId, "Aylık plan hazır. Gönderi üretimine geçilebilir.");
      return { success: true };

    } catch (err: any) {
      await pmLog("Plan", planId, `Aylık plan BAŞARISIZ: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // ─── 3. Gönderi Üretimi (tek) ─────────────────────────────────────────────

  static async startPostCreation(postId: number): Promise<{ success: boolean; error?: string }> {
    const MAX_COPY_RETRIES = 2;
    try {
      await pmLog("Post", postId, "Gönderi üretim süreci başlatıldı.");

      const copywriter   = new CopywriterAgent();
      const editor       = new EditorInChiefAgent();
      const engagement   = new EngagementSpecialistAgent();
      const inspiration  = new VisualInspirationAgent();
      const promptEng    = new PromptEngineerAgent();

      // Metin döngüsü: yaz → denetle → yeniden yaz (max 2 tekrar)
      let copyOk = false;
      for (let i = 0; i <= MAX_COPY_RETRIES; i++) {
        copyOk = await copywriter.execute(postId);
        if (!copyOk) throw new Error("Copywriter başarısız.");

        const editorOk = await editor.execute(postId);
        if (!editorOk) throw new Error("EditorInChief başarısız.");

        // EditorInChief NEEDS_REWRITE verdiyse tekrar dene
        const refreshed = await prisma.post.findUnique({ where: { id: postId }, select: { status: true } });
        if (refreshed?.status !== POST_STATUS.NEEDS_REWRITE) {
          copyOk = true;
          break;
        }
        await pmLog("Post", postId, `Metin yeniden yazılıyor (deneme ${i + 2})...`);
      }

      // Hala needs_rewrite ise insan müdahalesine yönlendir
      const finalPost = await prisma.post.findUnique({ where: { id: postId }, select: { status: true } });
      if (finalPost?.status === POST_STATUS.NEEDS_REWRITE) {
        await prisma.post.update({ where: { id: postId }, data: { status: POST_STATUS.NEEDS_HUMAN } });
        throw new Error("Metin kalite eşiğini geçemedi, insan müdahalesi gerekiyor.");
      }

      // Etkileşim Uzmanı
      const engOk = await engagement.execute(postId);
      if (!engOk) throw new Error("EngagementSpecialist başarısız.");

      // Görsel İlham (bloklayıcı değil — başarısız olsa pipeline devam eder)
      await inspiration.execute(postId);

      // Prompt Mühendisi
      const promptOk = await promptEng.execute(postId);
      if (!promptOk) throw new Error("PromptEngineer başarısız.");

      await pmLog("Post", postId, "Gönderi metni ve görsel promptu tamamlandı.");
      return { success: true };

    } catch (err: any) {
      await pmLog("Post", postId, `Gönderi üretimi BAŞARISIZ: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // ─── 4. Görsel Üretim + QA Döngüsü ───────────────────────────────────────

  static async startImageGenerationWithRetry(postId: number): Promise<{ success: boolean; error?: string }> {
    const MAX_IMG_RETRIES = 3;
    await pmLog("Post", postId, "Görsel üretim ve QA döngüsü başlatıldı.");

    const imgGen    = new ImageGeneratorAgent();
    const inspector = new VisualInspectorAgent();

    for (let attempt = 1; attempt <= MAX_IMG_RETRIES; attempt++) {
      const genOk = await imgGen.execute(postId);
      if (!genOk) {
        await pmLog("Post", postId, `Görsel üretim başarısız (deneme ${attempt}).`);
        if (attempt < MAX_IMG_RETRIES) {
          const waitSec = attempt * 60;
          await pmLog("Post", postId, `Quota bekleme: ${waitSec}s sonra yeniden deneniyor...`);
          await new Promise(r => setTimeout(r, waitSec * 1000));
        }
        continue;
      }

      const qcOk = await inspector.execute(postId);
      if (qcOk) {
        await pmLog("Post", postId, `Görsel QC'yi geçti (deneme ${attempt}).`);
        return { success: true };
      }

      await pmLog("Post", postId, `Görsel reddedildi (deneme ${attempt}) — yeniden üretiliyor.`);
      if (attempt < MAX_IMG_RETRIES) {
        await new Promise(r => setTimeout(r, 30_000));
      }
    }

    await prisma.post.update({ where: { id: postId }, data: { status: POST_STATUS.NEEDS_HUMAN } });
    await pmLog("Post", postId, "KRİTİK: Görsel 3 denemede de geçemedi. İnsan müdahalesi gerekiyor.");
    return { success: false, error: "Görsel 3 denemede de reddedildi." };
  }

  // ─── 5. Tüm Plandaki Gönderileri Toplu İşle ──────────────────────────────

  static async processAllPostsInPlan(planId: number): Promise<{ success: boolean; processed: number; failed: number }> {
    await prisma.monthlyPlan.update({ where: { id: planId }, data: { status: PLAN_STATUS.POST_GENERATION } });
    await pmLog("Plan", planId, "Tüm gönderiler sıra ile üretiliyor...");

    const posts = await prisma.post.findMany({
      where: { planId, status: POST_STATUS.IDEATION },
      select: { id: true },
    });

    let processed = 0, failed = 0;
    const TEXT_TIMEOUT_MS = 5 * 60 * 1000; // 5 dakika / gönderi

    // Sequential (1 paralel) — rate limit sorunlarını önle
    await runWithConcurrency(posts, 1, async ({ id }) => {
      await new Promise(r => setTimeout(r, 1000)); // 1s delay between posts
      try {
        const result = await withTimeout(
          Orchestrator.startPostCreation(id),
          TEXT_TIMEOUT_MS,
          `Post#${id} metin üretimi`
        );
        if (result.success) processed++;
        else {
          failed++;
          await prisma.post.update({
            where: { id },
            data: { status: POST_STATUS.NEEDS_HUMAN },
          }).catch(() => {});
        }
      } catch (err: any) {
        failed++;
        await pmLog("Post", id, `HATA (izole): ${err.message}`);
        await prisma.post.update({
          where: { id },
          data: { status: POST_STATUS.NEEDS_HUMAN },
        }).catch(() => {});
      }
    });

    await pmLog("Plan", planId, `Metin üretimi: ${processed} başarılı, ${failed} başarısız.`);

    // Görsel üretim aşaması
    await prisma.monthlyPlan.update({ where: { id: planId }, data: { status: PLAN_STATUS.IMAGE_GENERATION } });

    const imagePosts = await prisma.post.findMany({
      where: { planId, status: POST_STATUS.IMAGE_PROMPT_READY },
      select: { id: true },
    });

    const IMAGE_TIMEOUT_MS = 10 * 60 * 1000; // 10 dakika / görsel (3 deneme * 3dk)
    let imgProcessed = 0, imgFailed = 0;
    await runWithConcurrency(imagePosts, 1, async ({ id }) => {
      await new Promise(r => setTimeout(r, 2000)); // 2s delay between images
      try {
        const result = await withTimeout(
          Orchestrator.startImageGenerationWithRetry(id),
          IMAGE_TIMEOUT_MS,
          `Post#${id} görsel üretimi`
        );
        if (result.success) imgProcessed++;
        else imgFailed++;
      } catch (err: any) {
        imgFailed++;
        await pmLog("Post", id, `GÖRSEL HATA (izole): ${err.message}`);
        await prisma.post.update({
          where: { id },
          data: { status: POST_STATUS.NEEDS_HUMAN },
        }).catch(() => {});
      }
    });

    await pmLog("Plan", planId, `Görsel üretim: ${imgProcessed} başarılı, ${imgFailed} başarısız.`);
    await prisma.monthlyPlan.update({ where: { id: planId }, data: { status: PLAN_STATUS.REVIEW } });

    // Archivist — arka planda çalışır, engelleyici değil
    new ArchivistAgent().execute(planId).catch(() => {});

    return { success: true, processed: processed + imgProcessed, failed: failed + imgFailed };
  }

  // ─── 6. Rapor Üret ────────────────────────────────────────────────────────

  static async generateClientReport(planId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const { ReportGeneratorAgent } = await import("./ReportGenerator");
      const ok = await new ReportGeneratorAgent().execute(planId);
      if (!ok) throw new Error("ReportGenerator başarısız.");
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // ─── 7. Asset Senkronizasyonu ─────────────────────────────────────────────

  static async syncBrandAssets(brandId: number, driveUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await new AssetManagerAgent().execute(brandId, driveUrl);
      if (!result.success) throw new Error(result.error ?? "AssetManager başarısız.");
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
