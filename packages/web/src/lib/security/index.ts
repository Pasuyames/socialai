// ─── Güvenlik Modülü — Tek İçe Aktarım Noktası (barrel) ──────────────────────
//
// Dışarıya istek atan (SSRF) ve LLM'e güvenilmez metin veren (prompt injection)
// tüm akışlar için merkezi güvenlik yardımcıları. Kullanım:
//
//   import { assertSafeUrl, safeFetch, fenceUntrusted } from "@/lib/security";
//
// Alt modüller (ssrf.ts / sanitize.ts) doğrudan da import edilebilir; bu barrel
// yalnızca tek noktadan erişim ve keşfedilebilirlik sağlar.

// SSRF koruması: yapısal + DNS-rebinding doğrulaması ve güvenli fetch
export {
  assertSafeUrl,         // yapısal URL doğrulama (protokol + statik özel IP/host)
  assertSafeUrlResolved, // + DNS çözümleyip dönen IP'leri denetler (rebinding)
  safeFetch,             // her redirect adımını yeniden doğrulayan güvenli fetch
  readLimited,           // gövdeyi boyut sınırıyla oku — safeFetch BOYUT denetlemez
  DEFAULT_MAX_BYTES,
} from "./ssrf";

// Prompt injection azaltma: güvenilmez metni temizle + XML-benzeri etiketle çitle
export {
  cleanText,       // kontrol/sıfır-genişlik karakter temizliği + uzunluk sınırı
  fenceUntrusted,  // <<ETIKET>> ile çitleyip modele "veri, talimat değil" der
} from "./sanitize";
