export const QUEUE_NAME = 'agent-jobs';

// Kuyruğa düşen iş türleri. Worker job.name'e göre doğru processor'a yönlendirir.
export const JOB_NAMES = {
  // Tek bir gönderinin metin üretimi (Birleşik Motor: ContentWriter → Editor → ...)
  PROCESS_POST: 'processPost',
  // Tek bir gönderinin görsel üretimi (ImageGenerator 4:5 feed + sharp 9:16 story
  // + VisualInspector QA). processPost başarıyla bitince OTOMATİK zincirlenir.
  PROCESS_IMAGE: 'processImage',
} as const;

export type JobName = typeof JOB_NAMES[keyof typeof JOB_NAMES];

// processPost iş yükü — kuyruğa eklenen ve worker'ın aldığı veri.
export interface ProcessPostPayload {
  postId: number;
  planId?: number;
  skipImages?: boolean;
}

// processImage iş yükü — metin tamamlandıktan sonra zincirlenen görsel işi.
export interface ProcessImagePayload {
  postId: number;
  planId?: number;
}
