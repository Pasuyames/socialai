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
