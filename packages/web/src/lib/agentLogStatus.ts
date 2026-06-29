// ─── AgentLog Durum Türetme ───────────────────────────────────────────────────
//
// AgentLog.status kolonu artık explicit. Ajanlar log yazarken status vermezse,
// action metninden otomatik türetilir (db.ts Prisma extension'ı bunu kullanır).
// Hem yeni loglar hem geçmiş backfill için tek kaynak.

export type AgentLogStatus = "SUCCESS" | "FAILED" | "NEEDS_HUMAN" | "INFO";

export function deriveAgentLogStatus(action: string): AgentLogStatus {
  const a = (action ?? "").toLocaleLowerCase("tr-TR");
  // Sıra önemli: önce başarısızlık, sonra insan-gerekli, sonra başarı.
  if (/başarısız|hata|durduruldu|edilemedi|reddedildi/.test(a)) return "FAILED";
  if (/kritik|müdahale|needs_human/.test(a)) return "NEEDS_HUMAN";
  if (/tamamlandı|hazır|üretildi|başarılı|geçti|eşleşti|onaylandı|indirildi/.test(a)) return "SUCCESS";
  return "INFO";
}
