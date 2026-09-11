import dns from "dns/promises";

// ─── SSRF Koruması ────────────────────────────────────────────────────────────
//
// Kullanıcı kontrollü URL'lere (marka websiteUrl, sitemap'ten gelen ürün/görsel
// linkleri) sunucu tarafından istek atmadan önce; özel/iç IP'lere, cloud metadata
// endpoint'lerine ve yerel adreslere erişimi engeller. DNS rebinding'e karşı
// hostname çözümlenip dönen IP'ler de denetlenir. Redirect'ler her adımda yeniden
// doğrulanır (redirect ile bypass engellenir).
//

const FETCH_TIMEOUT = 15_000;
const MAX_REDIRECTS  = 3;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";

// ─── IP Sınıflandırma ─────────────────────────────────────────────────────────

function isPrivateIPv4(ip: string): boolean {
  const m = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [, a, b] = m.map(Number);
  return (
    a === 0 ||                          // 0.0.0.0/8
    a === 10 ||                         // 10.0.0.0/8 özel
    a === 127 ||                        // loopback
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 CGNAT
    (a === 169 && b === 254) ||         // link-local / cloud metadata (169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) ||// 172.16.0.0/12 özel
    (a === 192 && b === 168) ||         // 192.168.0.0/16 özel
    a >= 224                            // multicast / rezerve
  );
}

function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (v === "::1" || v === "::") return true;        // loopback / unspecified
  if (v.startsWith("fc") || v.startsWith("fd")) return true; // unique local
  if (v.startsWith("fe80")) return true;             // link-local
  // IPv4-mapped (::ffff:127.0.0.1 gibi)
  const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

function isPrivateIP(ip: string): boolean {
  return ip.includes(":") ? isPrivateIPv6(ip) : isPrivateIPv4(ip);
}

// ─── URL Doğrulama (yapısal) ──────────────────────────────────────────────────

export function assertSafeUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Geçersiz URL formatı.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Sadece HTTP/HTTPS URL'lerine izin verilir.");
  }

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new Error("Yerel/iç adrese erişim yasak.");
  }

  // Host doğrudan IP ise hemen kontrol et
  if (/^[\d.]+$/.test(host) || host.includes(":")) {
    if (isPrivateIP(host)) throw new Error("Özel/rezerve IP adresine erişim yasak.");
  }

  return url;
}

// ─── URL Doğrulama (DNS çözümlemeli — rebinding'e karşı) ──────────────────────

export async function assertSafeUrlResolved(rawUrl: string): Promise<URL> {
  const url = assertSafeUrl(rawUrl);

  // Hostname zaten IP değilse çözümle ve dönen tüm IP'leri denetle
  const host = url.hostname.toLowerCase();
  if (!/^[\d.]+$/.test(host) && !host.includes(":")) {
    let records: { address: string }[];
    try {
      records = await dns.lookup(host, { all: true });
    } catch {
      throw new Error("Hostname çözümlenemedi.");
    }
    for (const r of records) {
      if (isPrivateIP(r.address)) {
        throw new Error("Hostname özel/iç bir IP'ye çözümleniyor (SSRF engellendi).");
      }
    }
  }
  return url;
}

// ─── Güvenli Fetch (redirect'leri her adımda doğrular) ───────────────────────

export async function safeFetch(rawUrl: string, init: RequestInit = {}): Promise<Response> {
  let current = rawUrl;

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    await assertSafeUrlResolved(current);

    const res = await fetch(current, {
      ...init,
      redirect: "manual",
      signal: init.signal ?? AbortSignal.timeout(FETCH_TIMEOUT),
      headers: { "User-Agent": UA, ...(init.headers ?? {}) },
    });

    // Yönlendirme varsa hedefi yeniden doğrula
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      current = new URL(loc, current).toString();
      continue;
    }
    return res;
  }
  throw new Error("Çok fazla yönlendirme (olası SSRF).");
}

// ─── Boyut Sınırlı Gövde Okuma ───────────────────────────────────────────────
//
// safeFetch YALNIZCA nereye bağlanıldığını denetler, ne kadar veri indirildiğini
// DEĞİL. Çağıranlar gövdeyi doğrudan belleğe alıyordu (res.arrayBuffer()), yani
// dış kontrollü bir URL devasa bir yanıt döndürerek süreci şişirebilirdi (DoS).
// Content-Length yalanabildiği için akış da ayrıca sayılır.
export const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function readLimited(
  res: Response,
  maxBytes: number = DEFAULT_MAX_BYTES,
): Promise<Buffer> {
  // Ucuz ön eleme: sunucu dürüstse burada erken çıkarız.
  const declared = Number(res.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error(`Yanıt çok büyük (${declared} bayt > ${maxBytes}).`);
  }

  if (!res.body) return Buffer.alloc(0);

  const reader = res.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      // Gerçek boyut sınırı: Content-Length'e güvenilmez, akış sayılır.
      if (total > maxBytes) {
        throw new Error(`Yanıt çok büyük (>${maxBytes} bayt) — indirme durduruldu.`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    // Sınır aşımında bağlantıyı bırakma; aksi halde indirme arka planda sürer.
    await reader.cancel().catch(() => {});
  }

  return Buffer.concat(chunks, total);
}
