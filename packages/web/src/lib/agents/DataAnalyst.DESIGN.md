# DataAnalyst Agent — Mimari Tasarım Belgesi

**Durum:** Tasarım / Onay Aşaması — Henüz Kod Yazılmadı  
**Dosya Hedefi:** `src/lib/agents/DataAnalyst.ts`  
**Pipeline Konumu:** `Orchestrator.startMonthlyPlan()` → **Adım 1** (MarketingDirector'dan önce gelir)

---

## 1. `execute(planId: number)` Metodunun Ana Adımları

Metod `boolean` döner: başarıysa `true`, herhangi bir kritik hatada `false`.

```
Adım 1 — VERİTABANI SORGUSU
  MonthlyPlan'ı bul:
    - plan.brand (brandStrategy, toneOfVoice, rawScrapedData, name)
    - plan.brand.memories (son 3 ay, tarih azalan sıralı)
    - plan.brand.plans (tamamlanmış önceki planların posts sayısı — hafif JOIN)

Adım 2 — DOĞRULAMA (Guard Clauses)
  Eksikse → logActivity("HATA: ...") + return false:
    - plan bulunamadı
    - plan.brand.brandStrategy boş (Brand Strategist henüz çalışmamış)

Adım 3 — GEÇMIŞ PERFORMANS ÖZETİNİ HAZIRLA
  BrandMemory kayıtlarını JavaScript tarafında işle:
    - Son 3 ayın learnings alanlarını parse et
    - Neyin tuttuğunu, neyin tutmadığını özetleyen bir string oluştur
    - Hafıza yoksa "Yeni Marka: Geçmiş veri bulunmuyor" fallback'i kullan

Adım 4 — PROMPT OLUŞTURMA
  Aşağıdaki bağlamı prompt'a enjekte et:
    - brand.name, plan.month, plan.year
    - brandStrategy (executiveSummary + targetAudience.painPoints)
    - Adım 3'te hazırlanan geçmiş performans özeti
    - clientBrief (varsa)
  (Detaylar → Bölüm 5)

Adım 5 — LLM ÇAĞRISI
  generateText(prompt, isJson: true) ile Vertex AI'a gönder
  (Bağlantı detayları → Bölüm 5)

Adım 6 — JSON DOĞRULAMA VE SAVUNMACI PARSE
  Dönen string'i parse et, zorunlu alanları kontrol et
  (Strateji detayları → Bölüm 4)

Adım 7 — VERİTABANI GÜNCELLEME
  prisma.monthlyPlan.update({
    where: { id: planId },
    data: { trendReport: doğrulanmışJsonString }
  })

Adım 8 — BAŞARI LOGU + RETURN TRUE
  logActivity("Trend Raporu oluşturuldu ve kaydedildi.")
  return true
```

---

## 2. İhtiyaç Duyacağı Girdiler

### 2a. Fonksiyon Parametresi

| Parametre | Tip     | Açıklama                        |
|-----------|---------|----------------------------------|
| `planId`  | `number` | İşlenecek `MonthlyPlan` kaydının ID'si |

### 2b. Veritabanından Okunacak Alanlar

| Model         | Alan              | Zorunlu | Kullanım Amacı                             |
|---------------|-------------------|---------|---------------------------------------------|
| `MonthlyPlan` | `month`, `year`   | Evet    | Hangi dönem analiz ediliyor                 |
| `MonthlyPlan` | `clientBrief`     | Hayır   | Müşterinin bu ay için özel notları          |
| `Brand`       | `name`            | Evet    | Prompt'a marka adı enjeksiyonu              |
| `Brand`       | `brandStrategy`   | Evet    | `executiveSummary`, `targetAudience`, SWOT  |
| `Brand`       | `toneOfVoice`     | Hayır   | İçerik tonu ipuçları                        |
| `BrandMemory` | `learnings`       | Hayır   | Son 3 aylık geçmiş performans dersleri      |

### 2c. Çevre Değişkenleri (`llm.ts` üzerinden dolaylı)

| Değişken          | Zorunlu | Açıklama               |
|-------------------|---------|------------------------|
| `GCP_PROJECT_ID`  | Evet    | Vertex AI proje kimliği |
| `GCP_LOCATION`    | Hayır   | Varsayılan: us-central1 |

---

## 3. `trendReport` JSON Nesnesinin Tam ve Detaylı Yapısı

`MonthlyPlan.trendReport` alanına kaydedilen JSON string'in şeması.

> **Kritik Not:** `MarketingDirectorAgent` bu nesnenin 4 alanına doğrudan erişiyor
> (`pastPerformanceInsights`, `currentMonthlyTrends`, `contentFormatRecommendation`,
> `viralOpportunity`). Bu alanların adları ve tipleri değiştirilmemelidir.

```jsonc
{
  // --- META BİLGİ (Ajan tarafından kod içinde doldurulur, LLM'e yazdırılmaz) ---
  "generatedAt": "2026-05-01T10:30:00.000Z",  // ISO 8601
  "planMonth": 5,
  "planYear": 2026,
  "brandName": "Acme Co.",

  // --- GEÇMIŞ PERFORMANS (BrandMemory kayıtlarından türetilir) ---
  // MarketingDirector bu alanı okur.
  "pastPerformanceInsights": "Nisan ayında eğitim odaklı carousel postlar en yüksek kaydetme oranına ulaştı (%8.2). Promosyon postları düşük etkileşim aldı. Kamera arkası içerikleri hikayede beklenen paylaşımı sağlayamadı.",

  // --- GÜNCEL AY TRENDLERİ (LLM üretir) ---
  // MarketingDirector bu alanı okur.
  "currentMonthlyTrends": [
    "Mayıs'ta 'sürdürülebilirlik' ve 'doğallık' temaları Instagram'da yükseliyor",
    "Kısa form video (15-30 sn Reels) erişim algoritmada öncelikli",
    "Sektördeki rakipler Mother's Day kampanyalarına yöneliyor — farklılaşma fırsatı var"
  ],

  // --- FORMAT ÖNERİSİ (LLM üretir) ---
  // MarketingDirector bu alanı okur.
  "contentFormatRecommendation": "Bu ay öncelik sırası: 1) Eğitici Reels (15-30 sn), 2) Geçmişten-Bugüne Before/After Carousel, 3) Tek karelik motivasyon alıntıları. Story için anket ve soru kutusu kullanımı artırılmalı.",

  // --- VİRAL FIRSAT (LLM üretir) ---
  // MarketingDirector bu alanı okur.
  "viralOpportunity": "19 Mayıs Atatürk'ü Anma, Gençlik ve Spor Bayramı bu markanın 'güç' ve 'hareket' değerleriyle birebir örtüşüyor. Etkileyici bir Reels + UGC (Kullanıcı İçeriği) challenge'ı viral potansiyel taşıyor.",

  // --- EK ANALİTİK ALANLAR (Hem LLM üretir, hem ileride gerçek metriklerle beslenebilir) ---

  // Sektörel tehditler ve dikkat edilmesi gereken hareketler
  "competitorActivity": [
    "Ana rakip X, yoğun influencer işbirlikleri başlattı — fiyat indirimi iletişimiyle dikkat dağıtıyor",
    "Rakip Y Stories'de 'soru sorun' formatını aktif kullanıyor"
  ],

  // Takvimsel/mevsimsel fırsatlar (ay bazlı)
  "seasonalOpportunities": [
    "9 Mayıs Avrupa Günü (global awareness — B2B markalar için)",
    "19 Mayıs Gençlik Bayramı",
    "Anneler Günü (2. Pazar)"
  ],

  // Hedef kitlenin bu dönemdeki genel psikolojik tonu
  "audienceMoodSignal": "Bahar / yaz geçiş dönemi. Hedef kitle yenilenme, motivasyon ve mevsimsel alışveriş kararları için aktif arama modunda. Karar süreci hızlanıyor.",

  // Dikkat edilmesi gereken riskler veya kaçınılması gereken konular
  "riskAlerts": [
    "Siyasi içeriklerden kaçın — seçim hassasiyeti nedeniyle marka güvenliği riski var",
    "Fiyat paylaşımı promosyonlara dair geçen ayki olumsuz yorum trendi — bu ay fiyat odaklı mesajdan uzak dur"
  ],

  // Önerilen aylık toplam gönderi sayısı
  "recommendedPostingFrequency": 12,

  // Bu ay için önerilen başarı göstergeleri (hedef, gerçek değil)
  "kpiTargets": {
    "targetReach": "Geçen aya göre %15 artış",
    "targetEngagementRate": "%4.5",
    "targetSaves": "Her gönderi başına ortalama 50+",
    "targetProfileVisits": "Aylık 800+"
  }
}
```

---

## 4. Hata Yönetimi Stratejisi

### 4a. LLM Yanıt Vermezse

`llm.ts` zaten 4 deneme + exponential backoff içeriyor. Tüm denemeler başarısız olursa `llm.ts` bir `Error` fırlatır. `DataAnalyst` bunu yakalar:

```
try { ... } catch (error: any) {
  logActivity("HATA: LLM yanıt vermedi — " + error.message)
  return false
}
```

Orchestrator, `DataAnalyst`'ın `false` döndürmesini **soft failure** olarak değerlendiriyor (hattı durdurmaz, uyarı loglar). Bu tasarıma uygun olarak ajan `false` döndürür ama `throw` etmez.

### 4b. Bozuk / Eksik JSON Dönerse

LLM bazen markdown bloğu içinde veya kırık yapıda JSON döndürebilir.

**Adım 1 — Temizle:** `llm.ts`'in `isJson: true` modu `\`\`\`json` bloklarını zaten soyuyor. Ajan ek olarak baştaki/sondaki boşlukları trim eder.

**Adım 2 — Parse Et:** `JSON.parse()` try/catch içinde çalışır. Parse hatası → log + `return false`.

**Adım 3 — Zorunlu Alan Doğrulaması:** Parse başarılı olsa bile dört kritik alanı kontrol et:

```
const REQUIRED_FIELDS = [
  "pastPerformanceInsights",
  "currentMonthlyTrends",
  "contentFormatRecommendation",
  "viralOpportunity"
] as const;

for (const field of REQUIRED_FIELDS) {
  if (!parsed[field]) → HATA: "${field} alanı eksik" → return false
}
```

**Adım 4 — Meta Alanları Kod Tarafında Ekle:** LLM'nin üretmesi gerekmeyen `generatedAt`, `planMonth`, `planYear`, `brandName` alanları LLM çıktısı doğrulandıktan *sonra* JavaScript tarafında nesneye eklenir. Bu yaklaşım:
- Prompt'u kısaltır (LLM'ye tarih söyletmek gerekmez)
- Hatalı tarih formatı riskini ortadan kaldırır

### 4c. Kısmi Başarı Senaryosu

`BrandMemory` yoksa (`learnings` boşsa): `pastPerformanceInsights` için fallback değer `"İlk Ay — Geçmiş veri bulunmuyor. Temel strateji referans alındı."` olarak **kod içinde** sabit atanır, LLM'e bu sorumluluk yüklenmez.

### 4d. Genel Hata Akışı Özeti

```
Doğrulama hatası (plan/brand yok)  → log + return false
LLM hatası (4 deneme sonrası)      → log + return false
JSON parse hatası                  → log + return false
Zorunlu alan eksik                 → log + return false
DB update hatası                   → catch → log + return false
Her şey başarılı                   → log + return true
```

---

## 5. Vertex AI Altyapısıyla (`llm.ts`) Etkileşim

### 5a. Çağrı İmzası

```typescript
import { generateText } from "../llm";

const rawJson = await generateText(prompt, true);
//                                        ^^^^
//                          isJson: true → llm.ts ```json bloklarını soyar
```

### 5b. Prompt Mühendisliği Rehberi

`llm.ts`'in kullandığı model `gemini-2.5-pro`'dur (thinking model). Prompt aşağıdaki bölümleri içermelidir:

```
[ROL]
Sen bir dijital pazarlama veri analistinin.
Göreve odaklı, sayısal ve somut yanıt verirsin.

[BAĞLAM]
Marka: {brand.name}
Sektör özeti: {brandStrategy.executiveSummary}
Hedef Kitle Acıları: {brandStrategy.targetAudience.painPoints}
Ay/Yıl: {plan.month}/{plan.year}
Müşteri Notu: {plan.clientBrief | "Yok"}

[GEÇMİŞ PERFORMANS]
{hazırlanmış pastPerformanceSummary string'i}

[GÖREV]
Yukarıdaki bilgileri kullanarak bu marka için
{plan.month}/{plan.year} dönemine ait bir Trend ve Performans Raporu üret.

[FORMAT]
Yalnızca aşağıdaki JSON şemasında yanıt ver.
Markdown kullanma. Sadece ham JSON:
{ "pastPerformanceInsights": "...", "currentMonthlyTrends": [...], ... }
```

**Dikkat edilmesi gereken noktalar:**
- `gemini-2.5-pro` bir "thinking" modelidir; `llm.ts` `thought: true` parçaları zaten filtreler, bu DataAnalyst'ı etkilemez.
- Prompt sonuna `Sadece ham JSON` ve format şeması eklenmesi, modelin markdown sarmalaması yapmasını büyük ölçüde engeller.
- `isJson: true` flag'i `llm.ts`'in markdown temizleyicisini devreye sokar — ikinci bir güvenlik katmanıdır.

### 5c. Rate Limit Yönetimi

`llm.ts` zaten şunları yönetiyor:
- 429 / RESOURCE_EXHAUSTED → attempt × 8 saniye bekleme, 4 denemeye kadar
- Boş yanıt → `lastError` set edilir, döngü kırılır

DataAnalyst bu mekanizmalara dokunmaz; `generateText()`'in fırlattığı `Error`'ı yakalar ve `false` döner.

### 5d. Token Tasarrufu

`brandStrategy` alanı büyük bir JSON nesnesidir. Prompt'a *tamamını* koymak yerine yalnızca ilgili alt alanları (`executiveSummary`, `targetAudience.painPoints`, `coreValues`) çekip string olarak enjekte et. Bu, token kullanımını ve maliyeti düşürür.

---

## Pipeline İçindeki Yeri (Özet)

```
Orchestrator.startMonthlyPlan(planId)
  │
  ├─ [1] DataAnalystAgent.execute(planId)
  │       Yazar: MonthlyPlan.trendReport
  │       Okur:  Brand.brandStrategy, BrandMemory.learnings
  │
  ├─ [2] MarketingDirectorAgent.execute(planId)
  │       Okur:  MonthlyPlan.trendReport  ← DataAnalyst çıktısı
  │       Yazar: MonthlyPlan.directorBrief
  │
  └─ [3] IdeationSpecialistAgent.execute(planId)
          Okur:  MonthlyPlan.directorBrief ← MarketingDirector çıktısı
```
