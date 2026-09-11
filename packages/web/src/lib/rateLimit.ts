import { NextResponse } from "next/server";

// ─── Rate Limiting (bellek-içi sabit pencere) ────────────────────────────────
//
// Brute-force (login/register) ve maliyet-DoS (pahalı AI tetikleyicileri) için
// hafif, bağımlılıksız bir hız sınırlayıcı. Tek-instance için yeterlidir.
// NOT: Yatay ölçeklemede her instance kendi sayacını tutar — çok-instance
// dağıtımında Redis tabanlı bir limiter'a (worker'daki ioredis) geçilmelidir.

type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

// Bellek sızıntısını önlemek için süresi dolmuş kayıtları periyodik temizle
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [k, e] of store) if (now >= e.resetAt) store.delete(k);
}, 60_000);
// Test/script süreçlerini canlı tutmasın
(sweep as any).unref?.();

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number; // saniye
  remaining: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const e = store.get(key);

  if (!e || now >= e.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0, remaining: limit - 1 };
  }

  if (e.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((e.resetAt - now) / 1000), remaining: 0 };
  }

  e.count++;
  return { allowed: true, retryAfter: 0, remaining: limit - e.count };
}

// Başarılı işlem sonrası sayacı sıfırla (örn. başarılı login → kilidi aç)
export function resetRateLimit(key: string): void {
  store.delete(key);
}

// ─── İstemci IP'si ────────────────────────────────────────────────────────────
//
// ⚠️ `X-Forwarded-For` / `X-Real-IP` İSTEMCİNİN UYDURABİLDİĞİ başlıklardır.
// Uygulama doğrudan açıktaysa (veya ters proxy bu başlıkları EZMİYORSA),
// saldırgan her istekte farklı bir sahte IP göndererek IP başına uygulanan
// limitleri (örn. register 5/saat) sınırsız aşar. Bu yüzden başlıklara yalnızca
// `TRUST_PROXY` açıkken güvenilir.
//
// VARSAYILAN: GÜVENME (`TRUST_PROXY` yoksa/false).
// Gerekçe: bu proje PM2 ile doğrudan da açığa çıkabiliyor (bkz. DEPLOYMENT.md —
// nginx zorunlu değil). "Güven" varsayılanı, proxy'siz kurulumda sessizce
// sömürülebilir bir açık bırakır; "güvenme" varsayılanı ise en kötü ihtimalle
// limiti fazla sıkı yapar. Yanlış tarafa düşme maliyeti düşük olan seçenek bu.
//
// ⚠️ Next.js gerçeği: route handler'daki `Request` nesnesinden soket IP'si
// ALINAMAZ. Next kendi sunucusunda `x-forwarded-for`'u yalnızca başlık YOKSA
// (`??=`, base-server.js) soket adresiyle doldurur; istemci başlığı gönderdiyse
// onu olduğu gibi bırakır. Yani "Next doldurdu mu, istemci mi uydurdu"
// ayırt edilemez — güvenilir bir alternatif başlık yok.
//
// ⚠️ SONUÇ: güvenilmediğinde sabit `UNTRUSTED_IP` değeri döner, yani limit
// IP başına değil GLOBAL olur (tüm istemciler tek kovayı paylaşır). Şu an tek
// kullanıcısı register route'u olduğu için etkisi "saatte 5 kayıt (toplam)".
// Ters proxy arkasındaysanız `TRUST_PROXY=true` verin — limit tekrar IP bazına
// döner.
export const UNTRUSTED_IP = "untrusted";

function trustProxy(): boolean {
  const v = process.env.TRUST_PROXY?.trim().toLowerCase();
  return v === "true" || v === "1";
}

export function getClientIp(req: Request): string {
  if (!trustProxy()) return UNTRUSTED_IP;

  // Proxy'ye güveniyoruz. XFF zinciri: "<istemcinin uydurduğu...>, <proxy'nin gördüğü>"
  // nginx'in yaygın `$proxy_add_x_forwarded_for` ayarı istemcinin gönderdiği
  // değeri KORUYUP gerçek IP'yi SONA ekler → ilk eleman hâlâ sahte olabilir.
  // Bu yüzden SON eleman alınır: en yakın güvenilir proxy'nin fiilen gördüğü adres.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!;
  }
  return req.headers.get("x-real-ip")?.trim() || UNTRUSTED_IP;
}

// Route'larda tek satırlık kullanım: limit aşıldıysa 429 döndürür, yoksa null.
//   const limited = rateLimitOrError(`gen:${az.orgId}`, 30, 600_000);
//   if (limited) return limited;
export function rateLimitOrError(key: string, limit: number, windowMs: number): NextResponse | null {
  const r = rateLimit(key, limit, windowMs);
  if (r.allowed) return null;
  return NextResponse.json(
    { error: `Çok fazla istek. ${r.retryAfter} saniye sonra tekrar deneyin.` },
    { status: 429, headers: { "Retry-After": String(r.retryAfter) } },
  );
}
