import { Queue } from "bullmq";
import { QUEUE_NAME } from "@socialai/common";

// ─── BullMQ Kuyruk Singleton'ı ────────────────────────────────────────────────
//
// Bull-Board (gözlemlenebilirlik) için web tarafında kuyruk referansı. Worker ile
// AYNI Redis + AYNI kuyruk adını (@socialai/common) kullanır — böylece worker'a
// düşen işler bu panelde görünür.
//
// NOT: Dev'de Next hot-reload modülleri yeniden yükler; her seferinde yeni Queue +
// yeni Redis bağlantısı açmamak için globalThis üzerinde tekil tutulur.

const connection = {
  host: process.env.REDIS_HOST ?? "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
  // Redis kapalıysa istek asılı kalmasın — hızlı hata ver (panel "bağlanamadı" gösterir)
  maxRetriesPerRequest: null as null,
};

const globalForQueues = globalThis as unknown as { __agentQueue?: Queue };

export const agentQueue: Queue =
  globalForQueues.__agentQueue ?? new Queue(QUEUE_NAME, { connection });

if (process.env.NODE_ENV !== "production") {
  globalForQueues.__agentQueue = agentQueue;
}

// Bull-Board'a verilecek kuyruk listesi (ileride kuyruk eklenirse buraya)
export const allQueues: Queue[] = [agentQueue];
