import prisma from "./db";

// ─── Arka Plan İşi Hata Kaydı ─────────────────────────────────────────────────
//
// API route'larından "fire-and-forget" başlatılan arka plan işleri (onboarding,
// plan üretimi, görsel üretimi, yayınlama) başarısız olursa kullanıcı UI'da
// hiçbir iz görmez. Bu helper, ajanın kendi try/catch'inden KAÇAN hataları da
// AgentLog'a yazar (dashboard aktivite akışında görünür) + sunucu log'una basar.

export function logBgError(
  context: string,
  targetType: "Brand" | "Plan" | "Post",
  targetId: number,
) {
  return async (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[bg:${context}] ${targetType}#${targetId} BAŞARISIZ:`, err);
    await prisma.agentLog
      .create({
        data: {
          agentName: "Arka Plan İşi",
          action: `KRİTİK: ${context} beklenmedik şekilde durdu — ${message.slice(0, 300)}`,
          targetType,
          targetId,
        },
      })
      .catch(() => {}); // log yazımı da başarısız olursa sessiz geç (son çare)
  };
}
