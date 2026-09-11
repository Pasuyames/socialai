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
  // NOT: bazı ajanlar log metnini ASCII yazıyor ("PDF hazir", "zamanlandi"),
  // bu yüzden Türkçe karakterli ve ASCII varyantlar birlikte eşleşir. Aksi halde
  // tamamlanmış işler /admin/activity ekranında gri INFO rozetiyle görünüyordu.
  if (
    /tamamlandı|tamamlandi|hazır|hazir|üretildi|uretildi|başarılı|basarili/.test(a) ||
    /geçti|gecti|eşleşti|eslesti|onaylandı|onaylandi|indirildi/.test(a) ||
    /zamanlandı|zamanlandi|belirlendi|yayınlandı|yayinlandi|eklendi|güncellendi|guncellendi/.test(a)
  ) {
    return "SUCCESS";
  }
  return "INFO";
}
