import path from 'path';
import dotenv from 'dotenv';

// ── Env: önce worker/.env (REDIS), sonra web/.env (GCP / GEMINI / DATABASE_URL) ──
// dotenv override etmez → önce set edilen kazanır. Böylece worker'a özel REDIS
// ayarı korunur, web'in LLM/DB anahtarları da yüklenir. Web agent zinciri bunları
// modül yüklenirken okuduğu için Orchestrator DİNAMİK import edilir (aşağıda).
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../web/.env') });

import { Worker, type Job } from 'bullmq';
import { QUEUE_NAME, JOB_NAMES, type ProcessPostPayload } from '@socialai/common';

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

async function handleProcessPost(job: Job): Promise<unknown> {
  const { postId } = job.data as ProcessPostPayload;
  if (!postId) throw new Error('processPost: postId eksik.');

  // Web'in Birleşik Motor akışı (ContentWriter → EditorInChief → VisualInspiration
  // → PromptEngineer). Dinamik import: dotenv env'i set ETTİKTEN sonra yüklensin.
  const { Orchestrator } = await import('../../web/src/lib/agents/Orchestrator');
  const result = await Orchestrator.startPostCreation(postId);
  if (!result.success) throw new Error(result.error ?? 'startPostCreation başarısız.');
  return { postId, ...result };
}

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    switch (job.name) {
      case JOB_NAMES.PROCESS_POST:
        return handleProcessPost(job);
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
    process.exit(0);
  });
}
