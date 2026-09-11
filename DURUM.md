# 📊 SocialAI — Proje Durum Dosyası (Tek Kaynak / Single Source of Truth)

> **Bu dosyanın amacı:** Projenin güncel durumunu, açık işleri ve doğrulanmış
> bulguları tek yerde tutmak. Yeni bir oturumda soru sorulduğunda **önce bu dosya
> okunur** — tüm sohbet geçmişini veya tüm kod tabanını taramaya gerek yoktur.
>
> **Güncelleme kuralı:** Her çalışma günü sonunda / her iş paketi bittiğinde bu
> dosya güncellenir. Kapatılan bulgu `[x]` yapılır ve "Değişiklik Günlüğü"ne
> tarihli bir satır eklenir. Yeni bulgu çıkarsa ilgili önem tablosuna eklenir.

**Son güncelleme:** 2026-09-11 (6. tur — retry sınıflandırma, otomatik yenileme, log temizliği)
**Son tam inceleme:** 2026-09-08 (kod) · **2026-09-11 (Adım 1→7 canlı uçtan uca test)**

---

## 1. Hızlı Künye

| | |
|---|---|
| **Konum** | `C:\Users\musta\Projects\SocialAI` |
| **Dev portu** | **3001** (`packages/web` → `pnpm dev` → `next dev -p 3001`) |
| **Stack** | Next.js **16.3.4** (App Router + Turbopack), TypeScript, pnpm monorepo |
| **DB** | Prisma 5.22 + SQLite → **`packages/web/prisma/dev.db`** (491 KB, canlı) |
| **Kuyruk** | BullMQ + Redis 7 (Docker konteyner `socialai-redis`, host portu **6380**) |
| **Auth** | NextAuth v5 **beta.32** (JWT, Credentials), rol: `superadmin` / diğer |
| **Kimlik kapısı** | `src/proxy.ts` (Next 16'da `middleware.ts` deprecate edildi) |
| **LLM** | Google Vertex AI (Gemini 2.5-flash / 2.5-pro) |
| **Görsel** | Google AI Studio — **Nano Banana 2** (`gemini-3.1-flash-image`), **2K** |
| **Paketler** | `packages/web`, `packages/worker`, `packages/common` |

### Kardeş projeler (port çakışmasına dikkat)
Renza:3000 · **SocialAI:3001** · BekoAI:3002 · UpmindClone:3003 · Affa:3004 · AelineClone:3005

---

## 2. Sistem Sağlığı (2026-09-08 doğrulaması)

| Kontrol | Sonuç |
|---|---|
| `npx tsc --noEmit` | ✅ **0 hata** |
| Dev sunucu ayağa kalkıyor mu | ✅ `Ready in 3.9s` (Turbopack root fix sonrası) |
| Güvenlik başlıkları canlıda | ✅ CSP · X-Frame-Options: DENY · HSTS · nosniff · Referrer-Policy |
| API yetkilendirme kapsaması | ✅ 27/27 route korumalı (IDOR taraması temiz) |
| Git'te sızan secret | ✅ Yok — sadece `.env.example` dosyaları izleniyor |
| Rapor PDF erişimi | ✅ `public/` dışında, token + `authorizePlan` ile stream |

---

## 2.5 UÇTAN UCA CANLI TEST — 2026-09-11 (Adım 1 → 7)

Tüm akış gerçek API'lerle çalıştırıldı. **Görsel üretimi kredi kısıtı nedeniyle
toplam 2 adetle** test edildi (biri metin→görsel, biri ürün referanslı).

| Adım | Ne test edildi | Sonuç |
|---|---|---|
| 1 | Kayıt → giriş → marka → DataMiner→Strategist→Tone∥Visual | ✅ 2:15, 4 alan doldu |
| 2 | Plan → DataAnalystV2→Director→Ideation→Scheduler | ✅ 16 fikir, gerçek ürün adlarıyla |
| 3 | BullMQ kuyruk → worker → ContentWriter→Editor→PromptEngineer | ✅ editör 97/100, prompt 91/100 |
| 4 | Nano Banana 2 · 2K · **tek görsel** | ✅ 17.3 sn, 4:5 + story türetildi |
| 5 | VisualInspector QA (tek çalıştırma) | ✅ onay 92/100 |
| 6 | PDF rapor (LLM kullanmaz) | ✅ 1.7 MB, yetkili stream 200 / yetkisiz 307 |
| 7 | Publisher | ⚠️ sahte yayın bulundu → düzeltildi (bkz. K4) |
| + | Revizyon akışı (`postActions.ts`) | ✅ not uygulandı: emoji 1→4, ton yumuşadı |
| + | Org izolasyonu, plan limitleri, portal kapısı, SSRF | ✅ hepsi doğrulandı |
| 4b | **Ürün referanslı üretim + QA retry döngüsü** | ✅ referans mod devreye girdi, QA 1. denemede geçti (85/100) → 1 görsel |
| + | **Müşteri portalı — GERÇEK TARAYICI** (Playwright) | ✅ 8/8; görseller gerçekten render oldu (1080×1350), konsol hatası yok, onay DB'ye yazıldı |

**Hâlâ test EDİLMEYEN:** Instagram/LinkedIn'e **gerçek yayın** (kimlik bilgisi
yok — yalnızca reddetme ve simülasyon yolları test edildi) · **yük/eşzamanlılık**
(tek kullanıcı, tek post ile test edildi) · QA'nın gerçekten **reddettiği** bir
görselde retry'ın 2./3. turu (QA ilk denemede onayladığı için o dal çalışmadı).

---

## 3. BULGULAR

### 🔴 KRİTİK — 2026-09-11 canlı testinde bulunanlar

- [x] **K4 — Üretilen TÜM görseller ölü klasöre yazılıyordu.** ✅ ÇÖZÜLDÜ
  `.env`'deki `PUBLIC_DIR` proje `Desktop`'tan `Projects`'e taşındıktan sonra
  ESKİ yolda kalmıştı. ImageGenerator görselleri
  `Desktop/SocialAI/.../public/uploads`'a yazıyor, web sunucusu
  `Projects/SocialAI/.../public`'ten servis ediyordu → **üretim "başarılı"
  görünüyor ama her görsel URL'i 404.** `mkdir(recursive)` yanlış yolu
  memnuniyetle oluşturduğu için hata hiç fark edilmemişti; taşınmadan sonraki
  ilk görsel üretimi bu test olduğu için şimdi ortaya çıktı.
  **Yapılan:** `.env` düzeltildi, mahsur kalan 2 dosya taşındı, ImageGenerator'a
  "dizin yoksa yüksek sesle patla" koruması eklendi, `.env.example`'a uyarı yazıldı.
  **Doğrulama:** `/uploads/scene-….jpg → 200, 297 KB, image/jpeg`

- [x] **K5 — Çapraz-kiracı IDOR: başkasının markasına plan açılabiliyordu.** ✅ ÇÖZÜLDÜ
  `POST /api/plans` hiçbir yerde `authorizeBrand` çağırmıyordu. **Canlı
  doğrulandı:** org 6 kullanıcısı org 2'ye ait brand#4 üzerine HTTP 201 ile plan
  açtı. Etki: kurbanın AI bütçesini harcatma + panelini kirletme.
  Ayrıca oturum çözülemezse `orgId = null` kalıp kota kontrolü tamamen
  atlanıyordu (fail-open) ve `GET /api/plans` TÜM org'ların planlarını dönüyordu.
  **Yapılan:** `authorizeBrand` + Zod doğrulama + kota markanın SAHİBİ org'dan
  okunuyor; GET oturum zorunlu, superadmin dışında org filtresi şart.
  **Doğrulama:** yabancı/yetim marka → 403 · olmayan marka → 404 · ay 13 → 400

- [x] **K6 — Publisher gerçek paylaşım yapmadan "yayınlandı" işaretliyordu.** ✅ ÇÖZÜLDÜ
  Instagram/LinkedIn kimliği eksikken sistem sessizce simüle edip gönderiyi
  `published` yapıyor, `publishedAt` yazıyor, sahte `sim_ig_…` ID veriyordu —
  arayüzde gerçek yayından ayırt edilemez. Production'da token süresi dolsa
  müşteri "içeriğim yayında" sanırdı. Ayrıca `externalId` null dönse bile
  (ör. görsel yolu eksik) post `published` işaretleniyordu. Üstüne API her
  durumda `{ok:true}` 200 dönüyordu.
  **Yapılan:** simülasyon artık `PUBLISH_SIMULATE=true` ile AÇIK RIZA gerektiriyor;
  aksi halde hata + post `approved` kalır. `externalId` null → yayın sayılmaz.
  Publish route SENKRON çalışıyor, başarısızlıkta **502** dönüyor. Simüle yayın
  logu açıkça "gerçek paylaşım YAPILMADI" diyor.
  **Doğrulama:** kimlik yok → 502 + post `approved` · `PUBLISH_SIMULATE=true` → simüle çalışıyor

- [x] **K7 — `maxPostsPerPlan` kotası ajan seviyesinde uygulanmıyordu (eski O7).** ✅ ÇÖZÜLDÜ
  **Canlı doğrulandı:** Starter planı (kota 12) için sistem **16 gönderi** üretti
  — %33 ücretsiz kullanım. IdeationSpecialist adedi yalnızca brief'ten alıyor,
  kotayı hiç okumuyordu; ayrıca modelin döndürdüğü adet kırpılmıyordu.
  **Yapılan:** kota markanın sahibi org'dan okunuyor, mevcut gönderiler düşülüyor,
  model çıktısı `slice(0, postCount)` ile zorlanıyor.
  **Yan etki (test sırasında bulundu ve düzeltildi):** `IdeaListSchema` dizide
  sabit `min(4)` istiyordu; kota 4'ten az yer bıraktığında model doğru şekilde 1
  fikir dönüyor ama Zod reddedip iki denemeyi de boşa harcıyordu. Şema alt sınırı
  artık istenen adede uyarlanıyor.
  **Doğrulama:** "Brief 18 hedefliyordu; starter kotası nedeniyle 1'e düşürüldü"
  → 1 fikir üretildi → plan tam 12 = kota

### 🔴 KRİTİK — 2026-09-08 turunda kapatılanlar

- [x] **K1 — Müşteri portalı görselleri açılmıyor.** ✅ ÇÖZÜLDÜ
  `src/middleware.ts` matcher'ı `logos|images` dışlıyordu ama `uploads` ve
  `scraped-products` dışlanmamıştı → oturumsuz müşteri her görselde 307 yiyordu.
  **Yapılan:** matcher'a `uploads|scraped-products` eklendi.
  **Doğrulama:** `/uploads/…jpg → 307` **→ 200**. Regresyon yok:
  `/dashboard`, `/api/plans`, `/admin/activity` hâlâ 307.
  **Takas:** bu dosyalar artık URL'i bilen herkese açık (capability-URL modeli).
  Gizli hiçbir şey `public/` altına konmamalı.

- [x] **K2 — Portal onay/revizyon butonları çalışmıyor (sessiz veri kaybı).** ✅ ÇÖZÜLDÜ
  **Yapılan:** capability-token ile yetkilendirilen iki yeni uç açıldı:
  `api/client/[token]/posts/[id]/approve` ve `…/revise`, ortak yetki yardımcısı
  `api/client/[token]/_lib/authorize.ts` ile. `ClientPortalView` artık `res.ok`
  kontrol ediyor — başarısızsa iyimser güncelleme yapmıyor, hata gösteriyor.
  **Doğrulama (canlı, uçtan uca):** portal 200 · yabancı posta onay **403 (IDOR
  kapalı)** · geçersiz token 404 · boş not 400 · 2000+ karakter 400 · kendi
  postunu onay 200 + DB'ye `approved` yazıldı + AgentLog düştü.
  *(Test verisi tamamen geri alındı: token null'landı, post `client_review`'e
  döndürüldü, test logu silindi.)*

- [x] **K3 — `NEXTAUTH_URL` yanlış portu gösteriyor.** ✅ ÇÖZÜLDÜ
  `.env`'de `NEXTAUTH_URL` ve `NEXT_PUBLIC_APP_URL` 3000 → **3001**.
  **Doğrulama:** redirect artık `http://localhost:3001/login?...`

### 🟠 YÜKSEK

- [x] **Y1 — SSRF açığı.** ✅ ÇÖZÜLDÜ — `src/lib/llm.ts` `generateTextWithVision`
  artık `safeFetch` kullanıyor (10 sn timeout korundu). Engellenen URL'ler artık
  sessiz değil: host bazlı `console.warn` basılıyor, pipeline çökmüyor.

- [x] **Y2 — Rate limit atlatılabilir.** ✅ ÇÖZÜLDÜ — `getClientIp` artık
  `TRUST_PROXY` env'i ile koşullu, **varsayılan: güvenme**. Güvenildiğinde XFF
  zincirinin **son** elemanı alınıyor (nginx `$proxy_add_x_forwarded_for`
  ayarında ilk eleman hâlâ istemci uydurması olabiliyor).
  > ⚠️ **PROD'DA DİKKAT:** `TRUST_PROXY` kapalıyken kayıt limiti IP başına değil
  > **global** olur → saatte toplam 5 kayıt. Nginx arkasına alınca
  > `TRUST_PROXY=true` yapılmalı, yoksa gerçek kullanıcılar kilitlenir.
  > (Next 16.2.9'da route handler'da güvenilir soket-IP alternatifi yok:
  > `base-server.js:577` XFF'i yalnızca başlık yoksa dolduruyor.)

- [x] **Y3 — Plan limitleri yarım uygulanmış.** ✅ BÜYÜK ÖLÇÜDE ÇÖZÜLDÜ
  `clientPortal` kapısı `api/plans/[id]/client-token` ucuna kondu → Starter
  planı artık portal token'ı üretemiyor (403 + yükseltme mesajı). Plan bilgisi
  **JWT'den değil DB'den** okunuyor: `auth.ts` jwt callback'i `organizationPlan`'ı
  sadece ilk girişte yazıyor, superadmin planı düşürse bile JWT bayat kalıyordu.
  `checkLimit()` fail-closed yapıldı (sayısal olmayan alanda artık sessizce izin
  vermiyor), boolean özellikler için ayrı `hasFeature()` eklendi.
  → Kalan kısım için bkz. **O7**.

### 🟡 ORTA

- [x] **O1 — "Ürünü görerek üret" özelliği erişilemezdi.** ✅ ÇÖZÜLDÜ 2026-09-11
  Sebep bir "boş klasör" değil, **kodda sabitlenmiş bayraklardı**:
  `scrapeProductCatalog(url, { images: false })` ve
  `curateCatalog(..., { analyzeImages: false })` çağrı yerinde hardcoded'dı →
  `sync-products` ucu hiçbir koşulda paket görseli indiremiyordu → PromptEngineer'in
  atadığı `productImagePath` diskte bulunamıyor → ImageGenerator sessizce
  metin→görsele düşüyordu.
  **Düzeltme:** iki bayrak ayrıştırıldı — `downloadImages` (HTTP+disk, **LLM
  maliyeti YOK**, varsayılan AÇIK) ve `analyzeImages` (ürün başına Vision
  çağrısı, **ücretli**, varsayılan KAPALI, gövdede `{"analyzeImages":true}` ile
  açılır).
  > 📌 **DÜZELTME:** görseller `public/scraped-products`'ta **değil**,
  > `public/uploads/products/` altında. Önceki "katalog boş" teşhisi yanlış
  > klasöre bakıyordu; `scraped-products` kullanılmayan boş bir kalıntı.
  **Doğrulama:** 13 ürün → 12 paket görseli indirildi (HTTP 200 `image/webp`) ·
  tam akış çalıştırıldı, **ürün referanslı mod devreye girdi** (dosya öneki
  `product-`), QA ilk denemede geçti (85/100), **toplam 1 görsel** · üretilen
  görselde gerçek etiket birebir korunmuş ("%100 Gıda", "BADEM UNU / ALMOND
  FLOUR", "Net Ağırlık: 250g").
  **Yan kazanım:** hiç test edilmemiş **QA retry döngüsü** de böylece çalıştırıldı.
- [x] **O2 — Ölü kod temizliği.** ✅ ÇÖZÜLDÜ (kısmen düzeltildi)
  Silinenler: `agents/DataAnalyst.ts`, `agents/EngagementSpecialist.ts`,
  `agents/ClientLiaison.ts`.
  **DÜZELTME — ilk teşhis yanlıştı:** `utils/brandColorExtractor.ts` ve
  `agents/Copywriter.ts` ölü DEĞİL. İlk tarama sadece `src/` ve `scripts/`
  altına baktığı için **paket kökündeki** script'ler kaçmıştı:
  `extract-brand-assets.ts` → brandColorExtractor · `recaption-posts.ts` →
  Copywriter. İkisi de yerinde bırakıldı.
  > 📌 **DERS:** bu repoda ölü kod ararken `packages/web/*.ts` (paket kökü)
  > mutlaka taranmalı — orada ~20 tane bakım script'i duruyor.
  `DataAnalyst.DESIGN.md` bilinçli bırakıldı (tasarım dokümanı, V2'yi besledi).
- [x] **O3 — Revizyon eski motoru kullanıyor.** ✅ ÇÖZÜLDÜ
  Doğrulandı: `ContentWriter.ts:116` revizyon notunu gerçekten okuyor
  (`NEEDS_REWRITE` + `revisionNotes` → prompt'a "REVİZYON TALEBİ" bloğu →
  işlendikten sonra temizleniyor), yani geçiş notu kaybetmiyor.
  **Ayrıca kök sebep giderildi:** onay/revizyon mantığı iki route'a kopyalanmıştı
  ve tam da bu yüzden ajans ucu ContentWriter'a taşınırken müşteri ucu
  Copywriter'da kalmıştı. Yeni `src/lib/postActions.ts` tek kaynak oldu
  (`approvePost`, `requestRevision`, `validateRevisionNotes`); **dört route** da
  onu çağırıyor. Arka plan hatası artık `.catch(console.error)` değil
  `logBgError` ile AgentLog'a düşüyor → `/admin/activity`'de görünür.
- [x] **O4 — İki tane `dev.db` var.** ✅ ÇÖZÜLDÜ — çöp `packages/web/dev.db`
  (28 KB, 4 tablo) silindi. `.db` gitignore'da olduğu için git'ten dönmezdi,
  önce scratchpad'e yedeklendi. Canlı `prisma/dev.db` (491 KB) yerinde.
- [x] **O5 — Başıboş `package-lock.json`.** ✅ ÇÖZÜLDÜ — silindi; ayrıca
  `.gitignore`'a `package-lock.json` + `yarn.lock` engeli eklendi ki tekrar
  sızmasın (Turbopack workspace-root yavaşlığının sebebi buydu).
  `public/scraped-products/` de gitignore'a eklendi.
- [ ] **O6 — Langfuse hâlâ kapalı** (kullanıcının gerçek anahtarını bekliyor).
  ✅ İyileştirme: boş/placeholder anahtar artık "ayarlanmış" sayılmıyor ve
  devre dışı kalındığında **bir kez uyarı loglanıyor** — sessiz devre dışılık
  bir tuzaktı (değerler `""` olduğu için tracing aylarca kapalı kalmıştı). `.env`'de anahtarlar var ama değerleri
  2 karakter (boş tırnak/placeholder) → `getLangfuse()` `null` dönüyor.
  **Kod tarafı %100 hazır, sadece gerçek anahtar bekliyor:**
  `LANGFUSE_PUBLIC_KEY=pk-lf-...` · `LANGFUSE_SECRET_KEY=sk-lf-...` ·
  `LANGFUSE_HOST=https://cloud.langfuse.com`
- [x] **O7 — `maxPostsPerPlan` üretim adedini sınırlayamıyor.** ✅ ÇÖZÜLDÜ 2026-09-11 → bkz. **K7**
- [x] **O10 — Dashboard sayfalarında fail-open kapsam.** ✅ ÇÖZÜLDÜ
  4 sayfa `where: orgId ? {...} : {}` kullanıyordu — kimlik çözülemezse TÜM
  org'ların verisi. Middleware arkasında oldukları için sömürülemiyordu ama tek
  bir middleware regresyonu doğrudan çapraz-kiracı sızıntısına çevirirdi.
  **Yapılan:** `lib/session.ts` → `getScope()` (fail-closed) eklendi;
  dashboard/brands/plans/settings ona bağlandı. ✅
- [x] **O11 — DataAnalystV2 kararsız.** ✅ ÇÖZÜLDÜ — kök sebep: şema modelden `agentVersion: z.literal("v2.1")` ve ISO zaman damgası istiyordu (içerik değil defter tutma alanı); model sapınca Zod tüm yanıtı reddedip iki denemeyi de yakıyordu. Artık kod dolduruyor. Eski açıklama: Aynı girdiyle bir çalıştırmada
  başarılı, diğerinde `2 denemede de geçerli JSON üretilemedi`. Bloklayıcı değil
  (orchestrator devam ediyor) ama her başarısızlık 2 premium çağrı harcıyor.
  Şema/prompt sadeleştirmesi veya daha toleranslı parse gerek.
- [x] **O12 — `tsx` web paketinde kurulu değil.** ✅ ÇÖZÜLDÜ — devDependency eklendi, `pnpm exec tsx` çalışıyor. Eski açıklama: Paket kökündeki bakım
  script'leri başlığında `npx tsx <dosya>` yazıyor ama tsx yalnızca
  `packages/worker`'da kurulu. Script'ler doğrudan çalıştırılamıyor; şimdilik
  `packages/worker/node_modules/.bin/tsx` ile çalışıyor. `web`'e devDependency
  olarak eklenmeli.
- [x] **O13 — Bakım script'leri eski motorda.** ✅ ÇÖZÜLDÜ — `recaption-posts.ts` ContentWriter'a geçirildi (ayrıca kalite eşiğini geçemeyen metni artık `needs_human` yapıyor, koşulsuz `client_review` değil); `retry-post.ts` yorumu düzeltildi. Eski açıklama:
  Ana hat ve iki revizyon ucu ContentWriter kullanırken bu kök seviyesi
  script'ler hâlâ `CopywriterAgent` çağırıyor → farklı formatta metin üretirler.
- [x] **O14 — Caption içine hashtag gömülüyor.** ✅ ÇÖZÜLDÜ — prompt zaten "gömme" diyordu ama model uymuyordu (tutarsız çıktı). `stripInlineHashtags()` kod tarafında zorluyor: etiketi silmek yerine `#` kaldırıp camelCase'i bölüyor ("#BademUnu ile" → "Badem Unu ile"), 7 vakalık test. Eski açıklama: Şema yorumu
  `caption: Sadece gövde metin (hashtag gömülü değil)` diyor ama ContentWriter
  caption'ın İÇİNE de hashtag koyuyor (`#BademUnu`, `#Glutensiz`) ve ayrıca
  `hashtags` alanını dolduruyor. Instagram'da geçerli bir stil ama tasarım
  belgesiyle çelişiyor — hangisi doğru, karar verilmeli.
- [x] **O9 — Next 16 `middleware` konvansiyonu deprecate.** ✅ ÇÖZÜLDÜ — `src/middleware.ts` → `src/proxy.ts`; 18 kontrollük kimlik matrisiyle doğrulandı. Eski açıklama:
  Dev sunucu uyarısı: *"The `middleware` file convention is deprecated. Please use
  `proxy` instead."* Şu an çalışıyor ama gelecek major'da kırılır.

### ⚪ DÜŞÜK / NOT

- [x] **Ajan hataları denetim loguna HAM yığın izi yazıyordu.** ✅ ÇÖZÜLDÜ 2026-09-11
  21 ajan hatayı olduğu gibi AgentLog'a döküyordu. Gerçek örnek: Prisma hatası
  Turbopack tarafından sarmalanmış, **920 karakter**, içinde **mutlak dosya
  yolları**, build iç detayları ve kod çerçevesi; asıl sebep ("Record to update
  not found") gürültünün en sonunda kaybolmuş. Son 400 kayıtta 4'ü yol sızdırıyordu.
  `lib/agentError.ts` → `cleanAgentError()`: gürültü satırlarını atar, yolları
  dosya adına indirger, sarmalayıcı hatalarda ASIL sebebi öne alır, 300 karakterde
  keser. **21 ajanın tamamına** uygulandı, 8 vakalık test.
  **Doğrulama:** 920 karakterlik örnek → **123 karakter**, yol yok, sebep korunmuş.
  *(Geçmişteki 4 kirli kayıt bilerek DÜZELTİLMEDİ — denetim izi geriye dönük
  değiştirilmez; yalnızca superadmin ekranında görünür.)*

- [ ] **`imagenEnabled` / `prioritySupport` ayırt edici değil.** Üç planda da
  `imagenEnabled: true`; `prioritySupport` sadece Agency'de true ama kodda
  karşılığı olan davranış yok (destek biletleri planı hiç okumuyor). Kod eklemek
  şu an ölü kod üretir — **iş kararı bekliyor.**
- [x] **Revize akışında kalite eşiği atlanabiliyor.** ✅ ÇÖZÜLDÜ — `postActions.requestRevision` artık EditorInChief postu `NEEDS_REWRITE`'ta bırakmışsa `NEEDS_HUMAN`'a düşürüyor. Eski açıklama: EditorInChief postu
  `NEEDS_REWRITE` bırakıp `true` dönerse route yine de `CLIENT_REVIEW`'e alıyor —
  eşiği geçemeyen metin müşteriye gidiyor. Orchestrator bunu `NEEDS_HUMAN`'a
  düşürerek doğru yönetiyor; revizyon yolu aynı korumaya sahip değil.
- [x] **`safeFetch` yanıt gövdesi sınırsız.** ✅ ÇÖZÜLDÜ — `readLimited()` eklendi (Content-Length ön elemesi + akış sayımı, yalan CL ile bypass edilemez, sınır aşımında bağlantı iptal). Vision 8 MB, katalog HTML 5 MB / görsel 8 MB. 4 vakalık test. Eski açıklama: `llm.ts`'te `res.arrayBuffer()`
  boyut sınırı olmadan base64'e çevriliyor → dış kontrollü URL çok büyük dosya
  döndürüp bellek şişirebilir. `MAX_BYTES` ile kapatılabilir.
- [x] **`safeFetch` DNS TOCTOU (rebinding penceresi).** ✅ ÇÖZÜLDÜ 2026-09-11
  `dns.lookup` ile doğrulanan IP ile undici'nin fiilen bağlandığı IP farklı
  olabiliyordu: saldırgan, TTL'i sıfırlanmış kendi alan adında iki sorgu arasında
  cevabı `127.0.0.1`'e çevirip doğrulamayı atlatabilirdi.
  **Yapılan:** `resolveAndValidate()` doğrulanan adresleri geri veriyor, `safeFetch`
  undici `Agent`'ın `connect.lookup` kancasıyla bağlantıyı **tam o IP'ye pinliyor**
  — ikinci DNS sorgusu yok. IP'yi URL'e yazmak yerine lookup'ı pinlemenin sebebi
  TLS: SNI ve sertifika doğrulaması gerçek hostname ile kurulmaya devam ediyor.
  Her redirect hop'u yeniden doğrulanıp yeniden pinleniyor; dispatcher her yolda
  kapatılıyor (bağlantı sızıntısı yok).
  **Doğrulama:** gerçek HTTPS 200/344 KB · HTTP→HTTPS yönlendirme izleniyor ·
  loopback + AWS metadata + özel ağ + localhost hâlâ engelli · **kritik kanıt:
  toplam 1 DNS sorgusu** · ürün senkronizasyonu yeni safeFetch ile çalışıyor
  (13 ürün, 12 görsel).
- [x] **Rate limit bellek-içi — BİLİNÇLİ, mimariyle tutarlı.** ✅ değerlendirildi
  `ecosystem.config.js` web'i `instances: 1` çalıştırıyor ve gerekçesi yazılı:
  *"SQLite + oturum tutarlılığı için tekil"*. Web'i yatay ölçeklemek zaten önce
  Postgres'e geçmeyi gerektirir. Bugünkü mimaride bellek-içi sayaç **doğru**;
  Redis'e taşımak login yoluna gereksiz bir arıza noktası ekler (Redis düşerse
  giriş kırılır). Postgres'e geçildiğinde birlikte ele alınmalı. Eski açıklama: PM2 cluster veya çok-instance'ta sayaçlar
  paylaşılmıyor → limit instance sayısıyla çarpılır. Redis tabanlı limiter gerek.
- [x] ✅ ÇÖZÜLDÜ — `User.role` şema yorumu `owner|admin|member` diyordu, kod her yerde
  **`superadmin`** kontrol ediyor → dokümantasyon drift'i.
- [x] ✅ değerlendirildi — `runningOnboardings` Set'i process-içi, AMA onboarding yalnızca web'den tetikleniyor (worker `startPostCreation`/`startImageGenerationWithRetry` çağırıyor) ve web tek instance. Bugün etkili. Yatay ölçeklemede Redis kilidi gerekir. Eski açıklama: web ve worker ayrı process olduğu
  için çift tetiklenme koruması aslında paylaşılmıyor.
- [x] **`startImageGenerationWithRetry` boşa bekliyordu.** ✅ ÇÖZÜLDÜ 2026-09-11
  `ImageGeneratorAgent.execute` her hatada çıplak `false` dönüyordu, bu yüzden
  orkestratör **kalıcı** hatayı (prompt yok → API'ye hiç çıkılmıyor) **geçici**
  hatadan (kota/ağ) ayıramıyor ve HER ikisinde de 60+120 sn bekliyordu → bir
  worker slotu ~3 dakika boşa (concurrency=2'de kuyruğun yarısı).
  Artık `run()` `{ok, retryable, reason}` dönüyor; kalıcı hatada beklemeden
  `needs_human`'a düşülüyor, geçici hatada backoff sürüyor. Bekleme süreleri
  `IMAGE_QUOTA_WAIT_MS` / `IMAGE_QC_WAIT_MS` ile ayarlanabilir.
  **Doğrulama:** prompt'suz post → **180 sn yerine 0.1 sn**, API çağrısı yok,
  maliyet yok, statü doğru.
  Eski açıklama: `startImageGenerationWithRetry` job içinde 60+120 sn `sleep` yapıyor.
  Kilit yenilendiği için stall olmaz ama bir concurrency slotunu ~3.5 dk tutar.
- [x] **BAĞIMLILIK AÇIKLARI — 77 → 1.** ✅ ÇÖZÜLDÜ 2026-09-11
  > ⚠️ **Bu dosyadaki eski kayıt YANLIŞTI.** "5 high protobufjs" yazıyordu;
  > gerçek tablo **5 KRİTİK · 31 high · 36 orta · 5 düşük = 77** idi ve
  > kritiklerin ikisi doğrudan kimlik doğrulama katmanındaydı.
  **Bulunan kritikler:**
  - `next` 16.2.9 → **Windows sunucularda kimlik doğrulamasız RCE** (bu makine Windows)
  - `next` → **Middleware/Proxy bypass: App Router + Turbopack** (tam bizim kurulumumuz)
  - `next-auth` beta.31 → **yapılandırma hatasında auth kontrollerinin FAIL-OPEN olması**
    (`proxy.ts`'teki `if (!req.auth)` tam bu desen)
  - `@auth/core` → **homoglyph `@` ile email doğrulama bypass** (hesap ele geçirme)
  - `sharp` 0.34.5 → libvips/libheif CVE'leri (dış görselleri sharp ile işliyoruz)
  **Yapılan:** `next` 16.2.9→**16.3.4**, `next-auth` beta.31→**beta.32**,
  `sharp` 0.34.5→**0.35.4**; ayrıca kökteki pnpm override listesi 4'ten **19**'a
  çıkarıldı (protobufjs, undici, nanoid, js-yaml, postcss, brace-expansion ×2,
  qs, dompurify, esbuild, hono, @hono/node-server, browserslist, babel vb.).
  **Sonuç: kritik 0, high 0, orta 1, düşük 0.**
  **Doğrulama:** `tsc` 0 hata · **production build başarılı** (çıktıda
  `ƒ Proxy (Middleware)`) · **20/20 kontrollük nihai matris** (kimlik kapısı,
  giriş, IDOR, rapor, Bull-Board, portal) · Playwright tarayıcı testi 5/5.
- [ ] **Kalan tek açık: `uuid` (orta) — bilinçli kabul.**
  Yol: `@google-cloud/vertexai → google-auth-library → gaxios → uuid@9`.
  Açık yalnızca **v3/v5/v6'ya `buf` parametresi verildiğinde** tetikleniyor;
  gaxios sadece `v4()` (rastgele) çağırıyor → **bizim kullanımımızda erişilemez.**
  9→11 major bump'ı zorlamak google-auth-library'yi kırma riski taşır.
- [x] ~~5 high transitive açık: `protobufjs` ← `@google/genai` (gRPC).~~ ✅ override ile kapatıldı.
  Tehdit modelinde sömürülemez (sadece Google yanıtları parse ediliyor).
  Çözümü `@google/genai` 1.52 → 2.x **MAJOR** migration — bilinçli ertelendi.
- [x] **Activity ekranında otomatik yenileme yoktu.** ✅ ÇÖZÜLDÜ 2026-09-11
  `AutoRefresh` bileşeni: "Yenile" + "Otomatik" (10/30/60 sn) + son güncelleme
  saati. `router.refresh()` kullanır (tam sayfa yenileme yok → filtre, kaydırma
  ve odak korunur). **Varsayılan KAPALI** (denetim ekranı okunurken liste
  kaymasın) ve **sekme arka plandayken durur** (boşuna DB sorgusu yok).
  **Doğrulama:** Playwright ile 10 kontrol + filtre doğruluğu ayrıca kanıtlandı
  (FAILED → 50/50 "Başarısız", SUCCESS → 50/50 "Başarılı", DB ile tutarlı).

---

## 4. Commit'lenmemiş Değişiklikler (2026-09-08, düzeltme paketi sonrası)

**Yeni dosyalar:**
```
CLAUDE.md · DURUM.md
packages/web/src/lib/postActions.ts                        ← onay/revizyon tek kaynak
packages/web/src/app/api/client/[token]/_lib/authorize.ts  ← portal yetki yardımcısı
packages/web/src/app/api/client/[token]/posts/[id]/approve/route.ts
packages/web/src/app/api/client/[token]/posts/[id]/revise/route.ts
packages/web/.report-paths.cjs · packages/web/scripts/seed-soda-kristal.cjs
```
**Değişenler:** `.gitignore` · `packages/web/.env` (port, gitignored) ·
`.env.example` (TRUST_PROXY) · `next.config.ts` (turbopack root) ·
`package.json` (port 3001) · `middleware.ts` · `lib/llm.ts` · `lib/rateLimit.ts` ·
`lib/subscription.ts` · `api/plans/route.ts` · `api/plans/[id]/client-token` ·
`api/plans/[id]/ideate` · `api/posts/[id]/{approve,revise}` · `ClientPortalView.tsx`

**Silinenler:** `packages/web/dev.db` · `packages/web/package-lock.json` ·
`agents/{DataAnalyst,EngagementSpecialist,ClientLiaison}.ts`

> Henüz commit **edilmedi** — kullanıcının onayı bekleniyor.

---

## 5. Canlı Veri Durumu (2026-09-08)

```
5 org · 5 kullanıcı · 5 marka · 11 plan · 60 post · 606 agent log

Post durumu:  19 needs_human_intervention (%32) · 18 client_review · 16 approved
              2 qc_review · 1 published · 1 ideation · 1 writing · 1 generating_image
Log durumu:   355 INFO · 159 SUCCESS · 91 FAILED · 1 NEEDS_HUMAN
Plan durumu:  3 planning · 3 review · 2 generating_ideas · 1 image_generation
              1 ready · 1 post_generation_failed
Görseller:    public/uploads → 131 dosya / 43 MB
              public/scraped-products → 0 dosya (BOŞ, bkz. O1)
```

**⚠️ Önemli nüans:** 91 FAILED kaydın **tamamı 2026-06-29 ve öncesi**, yani eski
`Desktop\SocialAI` dönemi. Bunlar **eski enkaz, mevcut bozukluk değil.** Takılı
19 post da o dönemden. En son gerçek aktivite 2026-07-01 (seed/demo verisi).

**En çok hata veren ajanlar (tarihsel):** Orchestrator 39 · ProductCurator 15 ·
Copywriter 12 · ImageGenerator 10 (eski Vertex Imagen 4 dönemi) · Engagement 5

---

## 6. Mimari Harita (nerede ne var)

```
packages/common/src/queue.ts        QUEUE_NAME + JOB_NAMES (web ↔ worker sözleşmesi)
packages/worker/src/index.ts        BullMQ Worker · concurrency=2 · rate 8/60sn
                                    processPost → processImage zincirleme
                                    maybeAdvancePlan(): plan durumunu otomatik ilerletir
packages/web/src/
  middleware.ts                     Auth kapısı + PUBLIC_PATHS  ⚠️ K1 burada
  lib/
    db.ts                           Prisma singleton + agentLog.status auto-derive
                                    ⚠️ Edge Runtime'da $extends YOK (kritik fix, bozma!)
    auth.ts                         NextAuth v5 + login brute-force limiti
    authz.ts                        authorizeBrand/Plan/Post + authorize/authorizeAdmin
    llm.ts                          generateText/generateJSON/generateTextWithVision
                                    Model haritası + rate-limit fallback + Langfuse
    rateLimit.ts                    Bellek-içi sabit pencere limiter
    queues.ts                       BullMQ Queue singleton (Bull-Board için)
    reports.ts                      storage/reports/ + path-traversal koruması
    postActions.ts                  onay/revizyon TEK KAYNAK — 4 route buradan besleniyor
                                    (ikizlik O3'ün kök sebebiydi, tekrar kopyalama!)
    subscription.ts                 PLAN_LIMITS + checkLimit (fail-closed) + hasFeature
    security/{ssrf,sanitize}.ts     safeFetch · cleanText · fenceUntrusted
    agents/                         24 ajan (aşağıdaki akış)
    scrapers/ProductCatalog.ts      sitemap products.xml + JSON-LD yapısal çıkarım
  app/
    (dashboard)/                    Ajans arayüzü
    admin/queues/                   Bull-Board (superadmin, route-level auth şart!)
    admin/activity/                 Merkezi AgentLog ekranı (status kolonu ile)
    client/[token]/                 Müşteri portalı (capability-token)
    api/client/[token]/             Portalın oturumsuz uçları: report + posts/approve
                                    + posts/revise; ortak yetki: _lib/authorize.ts
                                    (IDOR kapısı: post.planId !== plan.id → 403)
    api/                            29 route, hepsi yetkilendirilmiş
```

### Ajan akışı (gerçek çalışan hat)

```
ONBOARDING:  DataMiner → BrandStrategist → (ToneOfVoice ∥ VisualResearcher)
PLAN:        DataAnalystV2 → MarketingDirector → IdeationSpecialist → ContentScheduler
POST:        ContentWriter → EditorInChief ⟲(max 2 revizyon) → VisualInspiration
             → PromptEngineer
GÖRSEL:      ImageGenerator → VisualInspector ⟲(max 3 deneme)
             ├ Ürün modu: gerçek paket referanslı Nano Banana 2 üretimi
             ├ Fallback:  sharp compositing (gradyan ürün kartı)
             └ Standart:  Nano Banana 2 metin→görsel
             Story 9:16 = feed 4:5'ten sharp ile türetilir (YENİ AI ÜRETİMİ YOK)
```

**Kullanılmayan ajanlar:** DataAnalyst (v1), EngagementSpecialist, ClientLiaison
(→ ContentWriter birleşik motoru bunların yerini aldı, bkz. O2)

---

## 7. Sık Kullanılan Komutlar

```powershell
# Dev sunucu (3001)
cd C:\Users\musta\Projects\SocialAI\packages\web ; pnpm dev

# Worker
cd C:\Users\musta\Projects\SocialAI\packages\worker ; pnpm dev

# Redis (Bull-Board + kuyruk için ŞART)
docker start socialai-redis          # host portu 6380

# Tip kontrolü
cd packages\web ; npx tsc --noEmit

# Şema değişikliği (migration klasörü YOK, db push kullanılıyor)
cd packages\web ; npx prisma db push ; npx prisma generate
```

### ⚠️ Bilinen Tuzaklar (tekrar yaşama)
1. **Dev sunucu açıkken `pnpm build` veya `pnpm add` ÇALIŞTIRMA** — `.next` bozulur,
   Internal Server Error verir. Sonrası: kill + `rm -rf .next` + restart.
2. **`lib/db.ts`'teki Edge Runtime guard'ını silme** — `$extends` Edge'de
   desteklenmiyor, middleware→auth→db zinciri tüm sayfaları 500'e düşürür.
3. **`next.config.ts`'teki `turbopack.root` ayarını silme** — yoksa Next
   `C:\Users\musta\package-lock.json`'ı görüp tüm ev dizinini workspace kökü
   seçiyor, derleme **3.4 dakikaya** çıkıyor.
4. **Redis 3.0.504 (Windows servisi) BullMQ için çok eski** (≥5 gerekiyor).
   Bu yüzden Docker `redis:7` konteyneri **6380** portunda çalışıyor.
5. **Görsel üretimini izinsiz test etme** — maliyet. Kullanıcıdan açık onay al.

---

## 8. Değişiklik Günlüğü

| Tarih | Yapılan |
|---|---|
| 2026-09-11 (5) | **Retry sınıflandırma + otomatik yenileme + log hijyeni.** ImageGenerator artık kalıcı/geçici hatayı ayırıyor: prompt'suz post **180 sn yerine 0.1 sn**'de insana devrediliyor (worker slotu boşa gitmiyor). Activity ekranına `AutoRefresh` eklendi (varsayılan kapalı, sekme arka plandayken durur). 21 ajanın ham yığın izi döken hata logları `cleanAgentError()` ile temizlendi — 920 karakterlik yol sızdıran kayıt 123 karaktere indi, asıl sebep korundu. tsc 0 hata, 15/15 final regresyon. |
| 2026-09-11 (4) | **DNS rebinding kapatıldı + hiç test edilmemiş yüzeyler.** `safeFetch` artık bağlantıyı doğrulanan IP'ye **pinliyor** (undici `connect.lookup`) → doğrulama ile bağlantı arasındaki TOCTOU penceresi yok; kanıt: toplam **1 DNS sorgusu**, TLS/SNI bozulmadı. Destek biletleri ve admin uçları ilk kez test edildi → **6 + 4 hata** bulundu (şema dışı `priority`/`category` kabul ediliyordu, 5000 karakter sınırsızdı, obje/bozuk JSON **500 ile çökertiyordu**, olmayan kayıt 404 yerine 500) → hepsi Zod ile kapatıldı, 12/12 + 11/11 doğrulandı. Tüm write uçları bozuk-JSON taramasından geçirildi. Langfuse'un sessiz devre dışılığı artık uyarı basıyor. Rate limit ve onboarding kilidi **gerekçeleriyle** ertelendi (web `instances: 1`, SQLite'a bağlı). |
| 2026-09-11 (3) | **Bağımlılık açıkları: 77 → 1.** `pnpm audit` çalıştırılınca bu dosyadaki "5 high protobufjs" kaydının yanlış olduğu ortaya çıktı: gerçekte **5 KRİTİK + 31 high** vardı ve ikisi kimlik doğrulama katmanındaydı (Next Windows RCE, Next Turbopack proxy bypass, next-auth fail-open, @auth/core homoglyph bypass, sharp libvips CVE'leri). next 16.2.9→16.3.4, next-auth beta.31→beta.32, sharp 0.34.5→0.35.4 + override listesi 4→19. Kritik 0, high 0. Production build başarılı, 20/20 nihai matris, Playwright 5/5. |
| 2026-09-11 (2) | **Açık bulguların temizliği.** O1 (ürün görseli indirme kodda sabit KAPALIYDI → "ürünü görerek üret" erişilemezdi; iki maliyet profili ayrıştırıldı, canlı doğrulandı: gerçek paket etiketi korunarak 1 görsel üretildi), O9 (middleware→proxy, 18 kontrollük kimlik matrisi), O10 (fail-closed `getScope()`), O11 (DataAnalystV2 kararsızlığının kök sebebi: modelden defter tutma alanı isteniyordu), O12 (tsx), O13 (bakım script'leri ContentWriter'a), O14 (`stripInlineHashtags`, 7 test), revizyon kalite eşiği, `readLimited()` boyut sınırı (4 test), `User.role` şema yorumu. **Playwright ile gerçek tarayıcı portal testi 8/8.** tsc 0 hata, 8 kontrollük regresyon paketi temiz. |
| 2026-09-11 (1) | **Adım 1→7 uçtan uca canlı test** (görsel: tam 1 adet, kredi kısıtı). 4 KRİTİK bulgu bulundu ve kapatıldı: K4 görseller ölü klasöre yazılıyordu · K5 çapraz-kiracı plan IDOR'u · K6 Publisher sahte "yayınlandı" · K7 gönderi kotası uygulanmıyordu (16/12). Ayrıca O10 fail-open kapsam düzeltildi, `getScope()` eklendi, AgentLog durum türetmesi genişletildi (11 vakalık test), Zod mesajları Türkçeleştirildi. 4 yeni açık bulgu: O11 DataAnalystV2 kararsız · O12 tsx eksik · O13 eski motor script'leri · O14 caption/hashtag çelişkisi. `tsc` 0 hata. |
| 2026-09-08 (2) | **Düzeltme paketi — 3 paralel alt-ajan + orkestratör.** K1/K2/K3 + Y1/Y2/Y3 + O2/O3/O4/O5 kapatıldı. Yeni `lib/postActions.ts` ile onay/revizyon mantığındaki ikizlik giderildi (O3'ün kök sebebi). Müşteri portalı uçtan uca canlı doğrulandı (IDOR 403 dahil, test verisi geri alındı). `tsc --noEmit` 0 hata. 3 yeni bulgu açıldı: O7, O8, O9. |
| 2026-09-08 (1) | **Uçtan uca tam inceleme.** 3 kritik + 3 yüksek + 6 orta bulgu tespit edildi. Müşteri portalının iki ayrı sebeple tamamen kırık olduğu canlı curl ile doğrulandı (K1, K2). `NEXTAUTH_URL` port uyuşmazlığı (K3). Bu durum dosyası oluşturuldu. |
| 2026-08-24 | Dashboard/plans/UI iyileştirmeleri + gözlemlenebilirlik modülü (`211b91a`) |
| — | VisualInspector PUBLIC_DIR worker-cwd fix'i (`aca1d55`) |
| — | Canlı test bulguları: kuyruk + tone + org izolasyonu (`4097a88`) |
| — | PM2 + Docker Compose ile 7/24 production kurgusu (`06b9901`, `81609a7`) |
| — | Görsel fazı kuyruğa alındı, metin→görsel zincirleme (`a4b44b9`) |
| — | ContentWriter birleşik motoru (caption+hashtag+hook tek JSON) (`be4a0cf`, `c00fd06`) |
| — | AgentLog.status kolonu + Prisma Edge fix + Nano Banana 2 2K (`c7e8acd`) |
| — | Gözlemlenebilirlik: Bull-Board `/admin/queues` + `/admin/activity` (`a76e801`) |
| — | Kapsamlı güvenlik sertleştirmesi: 17 IDOR yüzeyi, SSRF, rate-limit, prompt injection, rapor ifşası, CSP/başlıklar, bağımlılık açıkları 38→15 |
