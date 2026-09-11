import prisma from "../db";
import { DataMinerAgent }            from "./DataMiner";
import { BrandStrategistAgent }      from "./BrandStrategist";
import { ToneOfVoiceSpecialistAgent } from "./ToneOfVoiceSpecialist";
import { VisualResearcherAgent }     from "./VisualResearcher";
import { DataAnalystV2Agent }        from "./DataAnalystV2";
import { MarketingDirectorAgent }    from "./MarketingDirector";
import { IdeationSpecialistAgent }   from "./IdeationSpecialist";
import { ContentSchedulerAgent }     from "./ContentScheduler";
import { ContentWriterAgent }        from "./ContentWriter";
import { EditorInChiefAgent }        from "./EditorInChief";
import { PromptEngineerAgent }       from "./PromptEngineer";
import { VisualInspirationAgent }    from "./VisualInspiration";
import { ImageGeneratorAgent }       from "./ImageGenerator";
import { VisualInspectorAgent }      from "./VisualInspector";
import { AssetManagerAgent }         from "./AssetManager";
import { ArchivistAgent }            from "./Archivist";
import { POST_STATUS, PLAN_STATUS }  from "../constants";
import { cleanAgentError } from "../agentError";

const PM = "Project Manager (Orkestratör)";

// Aynı anda çalışan onboarding işlemlerini takip eder (çift tetiklenme koruması)
const runningOnboardings = new Set<number>();

// ─── Yardımcı ─────────────────────────────────────────────────────────────────

async function pmLog(targetType: "Brand" | "Plan" | "Post", targetId: number, action: string) {
  await prisma.agentLog
    .create({ data: { agentName: PM, action, targetType, targetId } })
    .catch(() => {});
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
      await pmLog("Plan", planId, `Aylık plan BAŞARISIZ: ${cleanAgentError(err)}`);
      return { success: false, error: err.message };
    }
  }

  // ─── 3. Gönderi Üretimi (tek) ─────────────────────────────────────────────

  static async startPostCreation(postId: number): Promise<{ success: boolean; error?: string }> {
    const MAX_COPY_RETRIES = 2;
    try {
      await pmLog("Post", postId, "Gönderi üretim süreci başlatıldı.");

      // Birleşik içerik motoru: caption + hashtags + hook'u TEK structured JSON
      // çağrısında üretir (eski Copywriter + EngagementSpecialist yerine).
      const contentWriter = new ContentWriterAgent();
      const editor        = new EditorInChiefAgent();
      const inspiration   = new VisualInspirationAgent();
      const promptEng     = new PromptEngineerAgent();

      // Metin döngüsü: üret → denetle → (gerekirse) revizyon notuyla yeniden üret
      for (let i = 0; i <= MAX_COPY_RETRIES; i++) {
        const writeOk = await contentWriter.execute(postId);
        if (!writeOk) throw new Error("ContentWriter başarısız.");

        const editorOk = await editor.execute(postId);
        if (!editorOk) throw new Error("EditorInChief başarısız.");

        // EditorInChief NEEDS_REWRITE verdiyse (revisionNotes set eder) tekrar dene
        const refreshed = await prisma.post.findUnique({ where: { id: postId }, select: { status: true } });
        if (refreshed?.status !== POST_STATUS.NEEDS_REWRITE) break;

        await pmLog("Post", postId, `Metin yeniden yazılıyor (deneme ${i + 2})...`);
      }

      // Hala needs_rewrite ise insan müdahalesine yönlendir
      const finalPost = await prisma.post.findUnique({ where: { id: postId }, select: { status: true } });
      if (finalPost?.status === POST_STATUS.NEEDS_REWRITE) {
        await prisma.post.update({ where: { id: postId }, data: { status: POST_STATUS.NEEDS_HUMAN } });
        throw new Error("Metin kalite eşiğini geçemedi, insan müdahalesi gerekiyor.");
      }

      // Metin QA'yı geçti — hashtags/hook ContentWriter tarafından zaten yazıldı.
      // Görsel aşamasına hazır işaretle (eski akışta EngagementSpecialist yapardı).
      await prisma.post.update({ where: { id: postId }, data: { status: POST_STATUS.READY_FOR_IMAGE } });

      // Görsel İlham (bloklayıcı değil — başarısız olsa pipeline devam eder)
      await inspiration.execute(postId);

      // Prompt Mühendisi
      const promptOk = await promptEng.execute(postId);
      if (!promptOk) throw new Error("PromptEngineer başarısız.");

      await pmLog("Post", postId, "Gönderi metni (caption+hashtags+hook) ve görsel promptu tamamlandı.");
      return { success: true };

    } catch (err: any) {
      await pmLog("Post", postId, `Gönderi üretimi BAŞARISIZ: ${cleanAgentError(err)}`);
      return { success: false, error: err.message };
    }
  }

  // ─── 4. Görsel Üretim + QA Döngüsü ───────────────────────────────────────

  static async startImageGenerationWithRetry(postId: number): Promise<{ success: boolean; error?: string }> {
    const MAX_IMG_RETRIES = 3;

    // Bekleme süreleri env ile ayarlanabilir. Bu döngü bir BullMQ worker
    // slotunu MEŞGUL TUTAR (concurrency=2), bu yüzden beklemeler yalnızca
    // GERÇEKTEN geçici hatalarda yapılır — aşağıya bak.
    const QUOTA_WAIT_MS = parseInt(process.env.IMAGE_QUOTA_WAIT_MS ?? "60000", 10);
    const QC_WAIT_MS    = parseInt(process.env.IMAGE_QC_WAIT_MS    ?? "30000", 10);

    await pmLog("Post", postId, "Görsel üretim ve QA döngüsü başlatıldı.");

    const imgGen    = new ImageGeneratorAgent();
    const inspector = new VisualInspectorAgent();

    for (let attempt = 1; attempt <= MAX_IMG_RETRIES; attempt++) {
      const gen = await imgGen.run(postId);

      if (!gen.ok) {
        // KALICI hata (prompt yok, ürün dosyası yok, yapılandırma eksik):
        // tekrar denemek sonucu değiştirmez. Eskiden burada da 60+120 sn
        // bekleniyordu ve deterministik bir hata için worker slotu ~3 dakika
        // boşa harcanıyordu. Artık hemen insana devrediyoruz.
        if (!gen.retryable) {
          await prisma.post.update({ where: { id: postId }, data: { status: POST_STATUS.NEEDS_HUMAN } });
          await pmLog(
            "Post", postId,
            `KRİTİK: Görsel üretilemedi — kalıcı hata, tekrar denenmedi: ${gen.reason}`,
          );
          return { success: false, error: gen.reason };
        }

        await pmLog("Post", postId, `Görsel üretim başarısız (deneme ${attempt}): ${gen.reason}`);
        if (attempt < MAX_IMG_RETRIES) {
          const waitMs = QUOTA_WAIT_MS * attempt;
          await pmLog("Post", postId, `Geçici hata — ${Math.round(waitMs / 1000)}s sonra yeniden deneniyor...`);
          await new Promise(r => setTimeout(r, waitMs));
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
        await new Promise(r => setTimeout(r, QC_WAIT_MS));
      }
    }

    await prisma.post.update({ where: { id: postId }, data: { status: POST_STATUS.NEEDS_HUMAN } });
    await pmLog("Post", postId, "KRİTİK: Görsel 3 denemede de geçemedi. İnsan müdahalesi gerekiyor.");
    return { success: false, error: "Görsel 3 denemede de reddedildi." };
  }

  // ─── 5. Tüm Plandaki Gönderileri Toplu İşle ──────────────────────────────

  static async processAllPostsInPlan(
    planId: number,
    opts: { skipImages?: boolean } = {},
  ): Promise<{ success: boolean; enqueued: number; jobIds: string[] }> {
    await prisma.monthlyPlan.update({ where: { id: planId }, data: { status: PLAN_STATUS.POST_GENERATION } });

    const posts = await prisma.post.findMany({
      where: { planId, status: POST_STATUS.IDEATION },
      select: { id: true },
    });
    if (posts.length === 0) {
      await pmLog("Plan", planId, "Kuyruğa eklenecek gönderi yok (IDEATION boş).");
      return { success: true, enqueued: 0, jobIds: [] };
    }

    // Tüm gönderileri BullMQ kuyruğuna ekle (in-process sıralı çalıştırma yerine).
    // Concurrency & rate-limit WORKER tarafında yönetilir; ayrıca attempts+backoff
    // ile geçici hatalar (429 vb.) kuyruk seviyesinde de telafi edilir. İşler
    // Bull-Board panelinden (/admin/queues) canlı izlenebilir.
    const { agentQueue } = await import("../queues");
    const { JOB_NAMES }  = await import("@socialai/common");
    const skipImages = opts.skipImages ?? false;

    const jobs = await agentQueue.addBulk(
      posts.map((p) => ({
        name: JOB_NAMES.PROCESS_POST,
        data: { postId: p.id, planId, skipImages },
        opts: {
          attempts: 2,
          backoff: { type: "exponential" as const, delay: 5000 },
          removeOnComplete: false, // panelde görünür kalsın (gözlemlenebilirlik)
          removeOnFail: false,
        },
      })),
    );

    const jobIds = jobs.map((j) => String(j.id));
    await pmLog("Plan", planId, `${jobs.length} gönderi BullMQ kuyruğuna eklendi — worker eritince işlenecek.`);
    return { success: true, enqueued: jobs.length, jobIds };
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
