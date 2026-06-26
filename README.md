# SocialAI

> AI destekli, çok-ajanlı sosyal medya ajans otomasyonu — bir markanın web sitesinden başlayıp; strateji, aylık içerik planı, metin ve **gerçek ürün görselleriyle** post üretimine kadar tüm süreci yürütür.

Next.js 16 + Google Gemini / Imagen üzerine kurulu, çok-kiracılı (multi-tenant) bir SaaS. 24 uzman ajan bir **Orchestrator** etrafında, kıdemli bir ajans ekibinin iş akışını taklit eder.

---

## ✨ Öne Çıkanlar

- **Uçtan uca otomasyon:** Marka URL'si → derin analiz → strateji → aylık plan → 16+ post (metin + görsel) → QA → müşteri portalı
- **Gerçek ürün görselleri:** Ürün kataloğunu sitemap + JSON-LD'den çeker, paket görsellerini indirir; **Gemini 2.5 Flash Image** ile gerçek paketi referans alıp fotorealistik sahnelere yerleştirir (yapıştırma değil)
- **Görsel hafıza:** Yeni eklenen ürünleri Gemini Vision ile analiz edip (ambalaj, renk, mood) hafızaya kaydeder; sonraki içerikler bu estetiğe uyar
- **Çok-kiracılı:** Organizasyon bazlı izolasyon, abonelik planları, müşteri portalı (token'lı)
- **Üretim-seviyesi güvenlik:** IDOR/SSRF/rate-limit/prompt-injection korumaları, yetkili rapor erişimi, CSP + güvenlik başlıkları

---

## 🏗️ Mimari

Monorepo (pnpm workspace):

```
packages/
├── web/      → Next.js uygulaması (dashboard, API, ajanlar)
├── worker/   → BullMQ + Redis arka plan işçisi
└── common/   → Paylaşılan kuyruk/tip tanımları
```

### Pipeline

```
Marka Kurulumu          Aylık Plan              Post Üretimi            Görsel + QA
─────────────────       ──────────────          ────────────────        ──────────────
DataMiner          →    DataAnalystV2      →    Copywriter         →    PromptEngineer
BrandStrategist         MarketingDirector       EditorInChief           ImageGenerator
ToneOfVoice             IdeationSpecialist      EngagementSpecialist    VisualInspector (QA)
VisualResearcher        ContentScheduler        VisualInspiration       → Müşteri Portalı
ProductCurator                                  PromptEngineer
```

### Ajanlar (24)

**Kurulum/Analiz:** DataMiner · BrandStrategist · ToneOfVoiceSpecialist · VisualResearcher · ProductCurator · DataAnalyst(V2)
**Planlama:** MarketingDirector · IdeationSpecialist · ContentScheduler
**İçerik:** Copywriter · EditorInChief · EngagementSpecialist
**Görsel:** VisualInspiration · PromptEngineer · ImageGenerator · VisualInspector
**Operasyon:** Orchestrator · Publisher · ReportGenerator · PerformanceTracker · Archivist · AssetManager · ClientLiaison

---

## 🧰 Teknoloji

| Katman | Teknoloji |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Dil | TypeScript |
| LLM | Google Gemini 2.5 Flash / Pro |
| Görsel | Imagen 3 + Gemini 2.5 Flash Image (ürün referanslı) + Vision |
| DB / ORM | SQLite + Prisma |
| Kuyruk | BullMQ + Redis (worker) |
| Auth | NextAuth (JWT, credentials) |
| Scraping | Sitemap + JSON-LD, Jina Reader, Playwright, Cheerio |
| PDF | pdf-lib + pdfme |

---

## 🔒 Güvenlik

OWASP rehberlerine göre sertleştirildi:

- **Yetkilendirme:** `lib/authz.ts` — cross-tenant IDOR koruması (org-ownership, superadmin bypass) tüm API route'larında + dashboard sayfalarında
- **SSRF:** `lib/security/ssrf.ts` — özel IP / cloud-metadata engelleme + DNS rebinding + redirect doğrulama (`safeFetch`)
- **Rate-limit:** `lib/rateLimit.ts` — login/register brute-force + pahalı AI tetikleyicileri
- **Prompt injection:** `lib/security/sanitize.ts` — scrape edilen içerik LLM'e girmeden çitlenir
- **Rapor erişimi:** Raporlar `public/` dışında; yalnızca yetkili route veya müşteri token'ı ile stream edilir
- **Başlıklar:** CSP + X-Frame-Options + nosniff + HSTS + Referrer-Policy (`next.config.ts`)
- **Girdi doğrulama:** Zod (register, brands)

---

## 🚀 Kurulum

```bash
# 1. Bağımlılıklar
pnpm install

# 2. Ortam değişkenleri
cp packages/web/.env.example packages/web/.env
#   → .env içini doldur (AUTH_SECRET, GCP_PROJECT_ID, GOOGLE_APPLICATION_CREDENTIALS, vb.)

# 3. Veritabanı
pnpm --filter web exec prisma db push

# 4. Geliştirme sunucusu
pnpm dev:web        # http://localhost:3000

# (opsiyonel) arka plan işçisi
pnpm dev:worker
```

### Gerekli servisler
- **Google Cloud:** Vertex AI etkin proje + service-account anahtarı (Gemini & Imagen)
- **Redis:** worker için (BullMQ)

---

## 📁 Proje Yapısı (web)

```
src/
├── app/
│   ├── (auth)/         → login, register
│   ├── (dashboard)/    → markalar, planlar, postlar, ayarlar
│   ├── admin/          → süper-admin paneli
│   ├── client/[token]/ → public müşteri portalı
│   └── api/            → REST route'ları (authz korumalı)
├── lib/
│   ├── agents/         → 24 ajan
│   ├── security/       → ssrf, sanitize
│   ├── scrapers/       → ProductCatalog (sitemap + JSON-LD + Vision)
│   ├── authz.ts        → yetkilendirme
│   ├── rateLimit.ts    → hız sınırlama
│   ├── reports.ts      → güvenli rapor depolama
│   └── llm.ts          → Gemini sarmalayıcı (tier + fallback)
└── middleware.ts       → kimlik sınırı
```

---

## ⚠️ Notlar

- `.env`, GCP service-account anahtarı ve `dev.db` **repoya dahil değildir** (.gitignore).
- Üretilen görseller `public/uploads/`, raporlar `storage/reports/` altında tutulur (versiyonlanmaz).

---

*🤖 Bu projenin geliştirilmesi ve güvenlik sertleştirmesi [Claude Code](https://claude.com/claude-code) ile yapılmıştır.*
