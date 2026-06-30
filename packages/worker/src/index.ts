import path from 'path';
import dotenv from 'dotenv';

// ── Env: önce worker/.env (REDIS), sonra web/.env (GCP / GEMINI / DATABASE_URL) ──
// dotenv override etmez → önce set edilen kazanır. Böylece worker'a özel REDIS
// ayarı korunur, web'in LLM/DB anahtarları da yüklenir. Web agent zinciri bunları
// modül yüklenirken okuduğu için Orchestrator DİNAMİK import edilir (aşağıda).
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../web/.env') });

import { Worker, Queue, type Job } from 'bullmq';
import {
  QUEUE_NAME, JOB_NAMES,
  type ProcessPostPayload, type ProcessImagePayload,
} from '@socialai/common';

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  maxRetriesPerRequest: null as null,
};

// Rate-limit & concurrency — Google AI Studio kotasını korumak için kontrollü
// paralellik. Sıralı in-process'e göre daha hızlı, ama limiter 429'u önler.
const CONCURRENCY    = parseInt(process.env.WORKER_CONCURRENCY ?? '2', 10);
const RATE_MAX       = parseInt(process.env.WORKER_RATE_MAX ?? '8', 10);
const RATE_DURATION  = parseInt(process.env.WORKER_RATE_DURATION ?? '60000', 10);

// Aynı kuyruğa job EKLEMEK için (job chaining: processPost → processImage).
const queue = new Queue(QUEUE_NAME, { connection });

// Metin üretimini görsele "hazır" gösteren statüler.
const IMAGE_READY_STATUSES = ['ready_for_image', 'image_prompt_ready'];

// Plan durumunu, kuyruktaki işler ilerledikçe OTOMATİK ilerlet (idempotent).
// In-process döngü kaldırıldığı için plan-seviyesi geçişleri burada yapılır:
//   - tüm metinler bitince (ideation/writing kalmadıysa) → image_generation
//   - tüm görseller bitince (image_prompt_ready/generating_image kalmadıysa) → review
// Concurrency'de iki job aynı anda kontrol etse de set idempotent olduğu için güvenli.
async function maybeAdvancePlan(planId: number | undefined, phase: 'text' | 'image'): Promise<void> {
  if (!planId) return;
  try {
    const { default: prisma } = await import('../../web/src/lib/db');
    const posts = await prisma.post.findMany({ where: { planId }, select: { status: true } });
    if (posts.length === 0) return;
    if (phase === 'text') {
      const pendingText = posts.some((p) => p.status === 'ideation' || p.status === 'writing');
      if (!pendingText) {
        await prisma.monthlyPlan.update({ where: { id: planId }, data: { status: 'image_generation' } });
        console.log(`[Worker] ⤴ plan#${planId}: tüm metinler hazır → image_generation`);
      }
    } else {
      const pendingImage = posts.some((p) => p.status === 'image_prompt_ready' || p.status === 'generating_image');
      if (!pendingImage) {
        await prisma.monthlyPlan.update({ where: { id: planId }, data: { status: 'review' } });
        console.log(`[Worker] ⤴ plan#${planId}: tüm görseller bitti → review`);
      }
    }
  } catch (e) {
    console.warn('[Worker] plan durum ilerletme atlandı:', (e as Error).message);
  }
}

async function handleProcessPost(job: Job): Promise<unknown> {
  const { postId, planId, skipImages } = job.data as ProcessPostPayload;
  if (!postId) throw new Error('processPost: postId eksik.');

  // Web'in Birleşik Motor akışı (ContentWriter → EditorInChief → VisualInspiration
  // → PromptEngineer). Dinamik import: dotenv env'i set ETTİKTEN sonra yüklensin.
  const { Orchestrator } = await import('../../web/src/lib/agents/Orchestrator');
  const result = await Orchestrator.startPostCreation(postId);
  if (!result.success) throw new Error(result.error ?? 'startPostCreation başarısız.');

  // ── Job chaining ── Metin hazır (READY_FOR_IMAGE / IMAGE_PROMPT_READY) ise,
  // postu OTOMATİK olarak görsel kuyruğuna at. skipImages ile devre dışı bırakılır.
  if (!skipImages) {
    const { default: prisma } = await import('../../web/src/lib/db');
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { status: true } });
    if (post && IMAGE_READY_STATUSES.includes(post.status)) {
      await queue.add(
        JOB_NAMES.PROCESS_IMAGE,
        { postId, planId } as ProcessImagePayload,
        { attempts: 2, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: false, removeOnFail: false },
      );
      console.log(`[Worker] ↪ post#${postId} görsel kuyruğuna zincirlendi (processImage).`);
    } else {
      console.warn(`[Worker] post#${postId} görsele hazır değil (status=${post?.status}) — zincirleme atlandı.`);
    }
  }

  // Tüm metinler bittiyse planı görsel aşamasına ilerlet.
  await maybeAdvancePlan(planId, 'text');

  return { postId, ...result };
}

async function handleProcessImage(job: Job): Promise<unknown> {
  const { postId } = job.data as ProcessImagePayload;
  if (!postId) throw new Error('processImage: postId eksik.');

  // Kusursuz görsel motoru: ImageGenerator (4:5 feed + sharp ile 9:16 story) +
  // VisualInspector QA döngüsü (3 denemeye kadar).
  const { Orchestrator } = await import('../../web/src/lib/agents/Orchestrator');
  const result = await Orchestrator.startImageGenerationWithRetry(postId);
  if (!result.success) throw new Error(result.error ?? 'Görsel üretimi başarısız.');

  // Tüm görseller bittiyse planı incelemeye (review) ilerlet.
  const { planId } = job.data as ProcessImagePayload;
  await maybeAdvancePlan(planId, 'image');

  return { postId, ...result };
}

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    switch (job.name) {
      case JOB_NAMES.PROCESS_POST:
        return handleProcessPost(job);
      case JOB_NAMES.PROCESS_IMAGE:
        return handleProcessImage(job);
      default:
        console.warn(`[Worker] Bilinmeyen job adı: ${job.name}`);
        return undefined;
    }
  },
  { connection, concurrency: CONCURRENCY, limiter: { max: RATE_MAX, duration: RATE_DURATION } },
);

worker.on('completed', (job, ret: any) => {
  console.log(`[Worker] ✓ job ${job.id} (${job.name}) tamamlandı${ret?.postId ? ` — post#${ret.postId}` : ''}`);
});
worker.on('failed', (job, err) => {
  console.error(`[Worker] ✗ job ${job?.id} (${job?.name}) başarısız:`, err.message);
});
worker.on('error', (err) => {
  console.error('[Worker] Worker hatası:', err.message);
});

console.log(
  `[Worker] Hazır. Kuyruk="${QUEUE_NAME}" · Redis ${connection.host}:${connection.port} · ` +
  `concurrency=${CONCURRENCY} · rate-limit=${RATE_MAX}/${RATE_DURATION / 1000}s`,
);

// Temiz kapanış
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    console.log(`[Worker] ${sig} alındı — kapanıyor...`);
    await worker.close();
    await queue.close();
    process.exit(0);
  });
}
