// ─── Ajan Hata Mesajı Temizleyici ────────────────────────────────────────────
//
// Ajanlar hatayı doğrudan `BAŞARISIZ: ${err.message}` şeklinde AgentLog'a
// yazıyordu. Bu, denetim iznine ham yığın izi döküyor:
//
//   BAŞARISIZ: Invalid `__TURBOPACK__imported__module__$5b$project$5d2f$...`
//   invocation in C:\Users\musta\Projects\SocialAI\packages\web\.next\dev\...
//   3216 const scoreNote = bestScore ? ` (prompt kalitesi: ${bestScore}/100)` : "";
//   → 3218 await __TURBOPACK__imported__module__...
//   An operation failed because it depends on one or more records that were
//   required but not found. Record to update not found.
//
// Üç ayrı sorun: (1) mutlak dosya yolları ve build iç detayları sızıyor,
// (2) kayıt kilobaytlarca şişiyor, (3) gerçek sebep gürültünün içinde kayboluyor
// — bu örnekte tek anlamlı cümle EN SONDA.
//
// Bu yardımcı: kod çerçevesini atar, yolları kısaltır, boşlukları toplar ve
// mesajı sınırlar. Tam ayrıntı zaten `console.error` ile sunucu log'una gider.

const MAX_LEN = 300;

/** Kod çerçevesi / derleyici gürültüsü / dosya-satır referansı olan satırlar. */
function isNoise(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (t.includes("__TURBOPACK__") || t.includes("__webpack_require__")) return true;
  if (/^at\s/.test(t)) return true;                       // stack frame
  if (/^\^+$/.test(t)) return true;                       // "^^^^"
  if (/^[→>]?\s*\d+\s*(\||\s)/.test(t)) return true;      // "3216 | kod" ve "→ 3218 kod"
  if (/^[A-Za-z]:[\\/]/.test(t)) return true;             // "C:\...\dosya.js:12:34"
  if (/\.next[\\/]/.test(t)) return true;                 // build çıktısı yolu
  if (/:\d+:\d+\s*$/.test(t)) return true;                // "...dosya.ts:3218:118"
  return false;
}

/** Kalan mutlak yolları yalnızca dosya adına indirger (yol sızıntısını keser). */
function stripPaths(s: string): string {
  return s
    // Windows: C:\a\b\c.ts → c.ts   (boşluk/tırnak görene kadar)
    .replace(/[A-Za-z]:[\\/][^\s"'`,;)]*[\\/]([^\s"'`,;)\\/]+)/g, "$1")
    // POSIX: /a/b/c.ts → c.ts (en az iki dizin derinliği)
    .replace(/\/(?:[\w.@-]+\/){2,}([\w.@-]+)/g, "$1");
}

/**
 * Hatadan AgentLog'a yazılabilir, kısa ve yol sızdırmayan bir mesaj üretir.
 *
 * Prisma gibi kütüphaneler asıl açıklamayı EN SONA koyar; ilk satır
 * "Invalid `…` invocation in" gibi bilgisiz bir başlıktır. Bu başlık tespiti
 * HAM metin üzerinde yapılır — gürültü filtresi başlığı zaten atacağı için
 * filtrelenmiş listeye bakmak yanlış sonuç veriyordu (ilk sürümdeki hata buydu).
 */
export function cleanAgentError(err: unknown): string {
  const raw =
    err instanceof Error ? err.message
    : typeof err === "string" ? err
    : (() => { try { return JSON.stringify(err); } catch { return String(err); } })();

  if (!raw || !raw.trim()) return "bilinmeyen hata";

  // Başlık tespiti HAM metinde (filtrelenmeden önce).
  const sarmalayici = /invalid\s+[`'"].*?[`'"]\s+invocation|^\s*error:\s|^\s*prismaclient/i.test(raw);

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => !isNoise(l));
  if (lines.length === 0) {
    return kes(stripPaths(raw).replace(/\s+/g, " ").trim());
  }

  // Sarmalayıcı bir hata ise ASIL SEBEP son anlamlı satırdır.
  const secilen = sarmalayici ? lines[lines.length - 1] : lines.join(" ");
  return kes(stripPaths(secilen).replace(/\s+/g, " ").trim());
}

function kes(s: string): string {
  return s.length > MAX_LEN ? s.slice(0, MAX_LEN - 1) + "…" : s;
}
