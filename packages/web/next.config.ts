import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Content-Security-Policy — Next App Router ile uyumlu temel politika.
// Next satır-içi script/stil enjekte ettiği için 'unsafe-inline' gerekir;
// 'unsafe-eval' yalnızca dev'de (Turbopack) gerekir, prod'da kaldırılır.
// React zaten çıktı kaçışı yaptığından XSS riski düşük — CSP savunma katmanıdır
// (frame-ancestors/object-src/base-uri/form-action sıkılaştırılmıştır).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:" + (isDev ? " ws:" : ""),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

// Tüm yanıtlara uygulanan güvenlik başlıkları
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },                       // clickjacking
  { key: "X-Content-Type-Options", value: "nosniff" },             // MIME sniffing
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HSTS — yalnızca HTTPS ardından anlamlı; prod'da etkilidir
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  transpilePackages: ['@socialai/common'],
  poweredByHeader: false, // X-Powered-By başlığını gizle (teknoloji parmak izi)
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
