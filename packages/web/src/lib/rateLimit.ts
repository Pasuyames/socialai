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

// İstek IP'sini güvenilir başlıklardan çıkarır
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
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
