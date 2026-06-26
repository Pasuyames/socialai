# 🚀 SocialAI — Mikro-Ajan (Multi-Agent) Mimarisi

Bu belge, SocialAI projesinin 17 farklı yapay zeka ajanından (Micro-Agents) oluşan otonom "Dijital Sosyal Medya Ajansı" yapısını ve güncellenmiş altyapısını tanımlar.

---

## 👥 1. Ajans Kadrosu (Mikro-Ajanlar)

### 👑 Yönetim ve Denetim
1. **Proje Yöneticisi (Project Manager):** Müşteri talebini alır, işi birimlere dağıtır ve süreci başlatır.
2. **Baş Editör (Editor-in-Chief):** Üretilen her içeriği "Marka Anayasası" ile kıyaslar. Uymayanı reddeder, uyanı onaylar.

### 🕵️ Araştırma ve Analiz
3. **Veri Madencisi (Data Miner):** Web sitesi, Instagram ve Google verilerini çeker (Scraping/API). Sadece veri toplar.
4. **Marka Stratejisti (Brand Strategist):** Ham veriden SWOT analizi, hedef kitle ve marka özeti çıkarır.
5. **İletişim Uzmanı (Tone of Voice Specialist):** Markanın dilini, kelimelerini ve yasaklı terimlerini belirler.

### ✍️ İçerik ve Metin
6. **Fikir Üretici (Ideation Specialist):** Gönderi konularını ve hook (dikkat çekici giriş) cümlelerini bulur.
7. **Metin Yazarı (Copywriter):** Marka sesine uygun gövde metnini yazar.
8. **Etkileşim Uzmanı (Engagement Specialist):** SEO, Hashtag ve Call-to-Action (CTA) cümlelerini ekler.

### 🎨 Görsel Sanatlar
9. **Görsel Araştırmacı (Visual Researcher):** Güncel Instagram/Pinterest tasarım trendlerini tarar.
10. **Prompt Mühendisi (Prompt Engineer):** AI görsel üretimi için teknik, kusursuz komutları yazar.
11. **Görsel Denetmen (Visual Inspector):** Çıkan görseli kontrol eder (hata, bozuk text, 6 parmak vs.), gerekirse yeniden ürettirir.

### 📂 Operasyon ve Yönetim
12. **Materyal Sorumlusu (Asset Manager):** Google Drive'daki müşteri fotoğraflarını ve logoları sisteme bağlar.
13. **İçerik Planlayıcı (Content Scheduler):** Gönderilerin ay içindeki takvim dağılımını (Pzt 19:00, Çar 20:00 vb.) yapar.
14. **PDF ve Rapor Uzmanı (Report Generator):** Onaylı içerikleri müşteriye sunulacak profesyonel PDF'e çevirir.
15. **Müşteri Temsilcisi (Revision Handler):** Müşteriden gelen "bunu beğenmedim" notlarını anlar ve ilgili ajana tercüme eder.

### 🗄️ Sistem ve Dağıtım
16. **Arşivci / Log Tutucu (Archivist):** Her ajanın ne yaptığını anlık olarak veritabanına yazar.
17. **Yayın Yöneticisi (Publisher):** Günü gelen içeriği Instagram/Facebook API üzerinden otomatik paylaşır.

---

## 🗄️ 2. Güncellenmiş Veritabanı Şeması (Prisma - PostgreSQL / SQLite)

Klasik yapıdan ziyade, ajanların birbirine iş devrettiği "Task/Job" tabanlı bir şema.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite" // İleride PostgreSQL yapılacak
  url      = "file:./dev.db"
}

// ==================== MARKA & KİMLİK ====================
model Brand {
  id               Int       @id @default(autoincrement())
  name             String
  slug             String    @unique
  websiteUrl       String?
  instagramHandle  String?
  driveFolderId    String?   // Asset Manager kullanacak
  
  // Ajanların Dolduracağı Alanlar
  rawScrapedData   String?   // Data Miner dolduracak
  brandStrategy    String?   // Brand Strategist dolduracak
  toneOfVoice      String?   // Tone of Voice Specialist dolduracak
  visualIdentity   String?   // Visual Researcher dolduracak
  
  plans            MonthlyPlan[]
  createdAt        DateTime  @default(now())
}

// ==================== AYLIK PLAN ====================
model MonthlyPlan {
  id              Int       @id @default(autoincrement())
  brandId         Int
  brand           Brand     @relation(fields: [brandId], references: [id])
  month           Int
  year            Int
  
  clientBrief     String?   // Müşterinin özel notları
  status          String    @default("planning") // planning, generating, review, ready
  
  posts           Post[]
}

// ==================== GÖNDERİLER ====================
model Post {
  id              Int       @id @default(autoincrement())
  planId          Int
  plan            MonthlyPlan @relation(fields: [planId], references: [id])
  
  // İçerik (Ajanlar Doldurur)
  topic           String?   // Ideation Specialist
  caption         String?   // Copywriter
  hashtags        String?   // Engagement Specialist
  imagePrompt     String?   // Prompt Engineer
  imagePath       String?   // Üretilen görsel yolu
  
  // Zamanlama
  scheduledAt     DateTime? // Content Scheduler
  
  // Durum
  status          String    @default("ideation") // ideation, writing, generating_image, qc_review, client_review, approved
  revisionNotes   String?   // Müşteri temsilcisi notları
}

// ==================== AJAN İŞ KAYITLARI (LOGS) ====================
model AgentLog {
  id              Int       @id @default(autoincrement())
  agentName       String    // Hangi ajan (Örn: Copywriter, Visual Inspector)
  action          String    // Ne yaptı? (Örn: "Metin yazıldı", "Görsel reddedildi")
  targetType      String    // Brand, Plan, Post
  targetId        Int       // İlgili ID
  details         String?   // JSON formatında ekstra detay veya hata logu
  createdAt       DateTime  @default(now())
}
```

---

## 🛠️ 3. Teknik Altyapı Kararları

1. **Framework:** Next.js (App Router) + TypeScript
2. **Veritabanı:** Prisma ORM
3. **Ajan İletişimi:** Arka planda Ingest/Upstash gibi bir Queue (Kuyruk) yapısı kullanılacak. Bir ajan işini bitirdiğinde, işi sıradaki ajanın kuyruğuna bırakacak.
4. **AI Modelleri:** 
   - **Analiz ve Kodlama/Plan:** Gemini 2.0 veya Claude 3.5 Sonnet
   - **Görsel Üretimi:** Flux.1 veya Imagen 3.0
5. **Depolama:** Vercel Blob, Supabase Storage veya AWS S3 (Görseller silinmesin diye)
