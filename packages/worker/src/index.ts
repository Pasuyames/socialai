import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Worker } from 'bullmq';
import { QUEUE_NAME } from '@socialai/common';

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
};

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    console.warn(`[Worker] Unknown job name: ${job.name}`);
  },
  { connection },
);

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} (${job.name}) completed successfully`);
});
worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} (${job?.name}) failed:`, err.message);
});
worker.on('error', (err) => {
  console.error('[Worker] Worker error:', err);
});

console.log(`[Worker] Ready. Listening for jobs on queue: "${QUEUE_NAME}"`);
