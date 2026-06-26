export const INDUSTRY = {
  FASHION:        "fashion",
  FOOD:           "food",
  TECH:           "tech",
  FITNESS:        "fitness",
  FINANCE:        "finance",
  LAW:            "law",
  REAL_ESTATE:    "real_estate",
  BEAUTY:         "beauty",
  EDUCATION:      "education",
  HEALTHCARE:     "healthcare",
  HOSPITALITY:    "hospitality",
  ECOMMERCE:      "ecommerce",
  AUTOMOTIVE:     "automotive",
  CONSTRUCTION:   "construction",
  INTERIOR:       "interior",
  CONSULTING:     "consulting",
  MEDIA:          "media",
  AGRICULTURE:    "agriculture",
  NGO:            "ngo",
  RETAIL:         "retail",
  INSURANCE:      "insurance",
  LOGISTICS:      "logistics",
  EVENTS:         "events",
  PERSONAL_BRAND: "personal_brand",
  GENERAL:        "general",
} as const;

export type Industry = typeof INDUSTRY[keyof typeof INDUSTRY];

export interface IndustryConfig {
  nameTR: string;
  strategyContext: string;
  contentRules: string;
  visualStyle: string;
  complianceWarnings?: string;
  trendSources: { identifier: string }[];
}

export const INDUSTRY_CONFIG: Record<string, IndustryConfig> = {

  [INDUSTRY.FASHION]: {
    nameTR: "Moda / Giyim",
    strategyContext: `Bu bir moda ve giyim markasıdır. Sektörde başarı: estetik kimlik, trend takibi, yaşam tarzı anlatısı ve duygusal bağ. Mevsimsel koleksiyonlar ve özel günler içerik takviminin omurgasını oluşturur.`,
    contentRules: `SEKTÖR: Moda / Giyim
- Görsel odaklı içerik — metin görseli tamamlar, açıklamaz
- Stil ilhamı, mix-match önerileri, "nasıl giyilir" formatları işe yarar
- Beden çeşitliliği ve kapsayıcılık mesajları güçlüdür
- Sezon geçişleri, özel günler (anneler günü, yılbaşı) içerik fırsatıdır
- KAÇIN: ürün listeleme postu, fiyat odaklı içerik, jenerik "yeni koleksiyon"`,
    visualStyle: `Moda fotoğrafçılığı estetiği. Doğal ışık veya sinematik stüdyo aydınlatması. Model veya flat-lay düzenlemesi. Temiz arka plan, güçlü renk uyumu. Editorial look, high fashion ya da street style — marka kimliğine göre.`,
    trendSources: [
      { identifier: "https://www.businessoffashion.com/news" },
      { identifier: "https://hypebeast.com" },
      { identifier: "https://www.vogue.com/fashion" },
    ],
  },

  [INDUSTRY.FOOD]: {
    nameTR: "Yemek / Restoran / Kafe",
    strategyContext: `Yemek ve içecek sektöründe içerik; açlık hissi uyandırmalı, mekan atmosferini yansıtmalı ve deneyim vaat etmelidir. Görsel kalite, koku ve lezzet hissiyatı yaratmak kritiktir.`,
    contentRules: `SEKTÖR: Yemek / Restoran / Kafe
- "Food porn" etkisi — yakın çekim, eriyen peynir, buhar, renk doygunluğu
- Tarif ipuçları, "sırrı" paylaşmak güven inşa eder
- Sezonluk menü değişiklikleri, özel günler içerik fırsatıdır
- Arka plan hikayesi: malzeme kaynağı, şef, üretim süreci
- KAÇIN: yalnızca menü fiyatı postu, karanlık/iştah kaçıran görseller, aşırı promosyon dili`,
    visualStyle: `Profesyonel food photography. Sıcak renk tonları, doğal ahşap veya mermer yüzeyler. Overhead (kuş bakışı) veya 45° açı. Buhar, akış, doku detayı. Sığ alan derinliği, hero ingredient ön planda.`,
    complianceWarnings: `Alkollü içecek içeriği varsa yaş kısıtlaması uyarısı ekle. Sağlık iddialarından kaçın ("metabolizmayı hızlandırır" gibi).`,
    trendSources: [
      { identifier: "https://www.eater.com" },
      { identifier: "https://foodandwine.com/news" },
      { identifier: "https://www.bonappetit.com/story" },
    ],
  },

  [INDUSTRY.TECH]: {
    nameTR: "Teknoloji / SaaS / Yazılım",
    strategyContext: `Teknoloji markalarında içerik; uzmanlık, güven ve somut değer üzerine kuruludur. B2B ise LinkedIn ağırlıklı düşünce liderliği; B2C ise problem-çözüm ve kullanım kolaylığı ön planda.`,
    contentRules: `SEKTÖR: Teknoloji / SaaS / Yazılım
- "Müşteri sorunu → ürün çözümü" formatı dönüşüm sağlar
- Veri, rakam, başarı hikayesi (case study snippet) güven inşa eder
- "Behind the tech" — nasıl çalışır, hangi problemi çözdük içeriği merak uyandırır
- LinkedIn'de thought leadership: sektör gözlemleri, tartışmalı fikirler
- KAÇIN: jargon dolu teknik açıklama, "yapay zeka" kelimesini her postda kullanmak`,
    visualStyle: `Minimal ve temiz tasarım. Koyu tema (dark UI) veya açık beyaz arka plan. Ürün ekran görüntüsü, UI mockup, soyut veri görselleştirmesi. İnsan+teknoloji etkileşimi. Fütüristik ama ulaşılabilir estetik.`,
    trendSources: [
      { identifier: "https://techcrunch.com" },
      { identifier: "https://venturebeat.com" },
      { identifier: "https://www.wired.com/category/business" },
    ],
  },

  [INDUSTRY.FITNESS]: {
    nameTR: "Spor / Fitness / Sağlıklı Yaşam",
    strategyContext: `Fitness ve sağlıklı yaşam sektöründe içerik; motivasyon, dönüşüm hikayeleri ve pratik bilgi üçgeninde döner. Topluluk hissi ve "sen de yapabilirsin" mesajı kritik.`,
    contentRules: `SEKTÖR: Spor / Fitness / Sağlıklı Yaşam
- Before/after dönüşüm (izinli), milestone kutlama içerikleri güçlüdür
- Pratik ipucu, antrenman detayı, beslenme önerisi — eğitici içerik
- Topluluk hikayesi, müşteri başarısı sosyal kanıt sağlar
- Motivasyon kısa ve özgün olmalı — klişe "no pain no gain" yasak
- KAÇIN: gerçekçi olmayan vücut standartları, "hızlı zayıflama" vaadi`,
    visualStyle: `Enerji dolu, dinamik. Hareket bulanıklığı veya dondurulmuş aksiyon karesi. Güçlü ışık, gölge oyunları. Açık hava veya profesyonel spor salonu ortamı. Marka rengiyle vurgu — atletik estetik.`,
    complianceWarnings: `"X kg'da zayıflayın" tarzı tıbbi vaatlerden kaçın. Takviye/ilaç içeriğinde yasal uyarı gerekebilir.`,
    trendSources: [
      { identifier: "https://www.menshealth.com/fitness" },
      { identifier: "https://www.shape.com/lifestyle/news" },
      { identifier: "https://barbend.com/news" },
    ],
  },

  [INDUSTRY.FINANCE]: {
    nameTR: "Finans / Yatırım / Muhasebe",
    strategyContext: `Finans sektöründe güven ve uzmanlık her şeyin önündedir. İçerik; karmaşık konuları basitleştirmeli, somut değer sunmalı ve düzenleyici uyumu gözetmelidir.`,
    contentRules: `SEKTÖR: Finans / Yatırım / Muhasebe
- Karmaşık finansal konuyu basit dille anlat — "bunu bilmiyordum" tepkisi hedefle
- Veri görselleştirmesi, infografik formatlar iyi performans gösterir
- "Kaçınılan yaygın hatalar" ve "bilmeden ödediğin maliyet" formatları dikkat çeker
- LinkedIn'de sektör analizi, piyasa yorumu düşünce liderliği sağlar
- KAÇIN: garanti yatırım getirisi vaadi, "kesin kazandırır" dili`,
    visualStyle: `Profesyonel ve güven verici. Temiz beyaz/lacivert/yeşil palet. Grafik ve veri görselleştirmesi. Minimalist iş ortamı. Hiçbir zaman karmaşık veya dağınık görsel — netlik ve otorite.`,
    complianceWarnings: `"Yatırım tavsiyesi" içeren ifadelerden kaçın veya "bu yatırım tavsiyesi değildir" notu ekle. Lisans gerektiren hizmetler için yasal uyarı.`,
    trendSources: [
      { identifier: "https://fintech.global/news" },
      { identifier: "https://www.bloomberg.com/technology" },
      { identifier: "https://www.ft.com/fintech" },
    ],
  },

  [INDUSTRY.LAW]: {
    nameTR: "Hukuk / Avukatlık",
    strategyContext: `Hukuk sektöründe dijital içerik; otoriteyi inşa etmek, erişilebilirliği artırmak ve potansiyel müşteride "bu avukat beni anlar" hissini yaratmak için kullanılır.`,
    contentRules: `SEKTÖR: Hukuk / Avukatlık
- "Bilmediğiniz hak/yükümlülük" formatı güçlü — eğitici içerik güven sağlar
- Somut senaryo üzerinden hukuki süreç açıklaması ilgi çeker
- Soru-cevap formatı (sık sorulan sorular) müşteri adayına ulaşır
- Ton kesinlikle kurumsal ve ölçülü olmalı — emoji minimal
- KAÇIN: spesifik hukuki tavsiye veriyormuş izlenimi, kesin sonuç vaadi`,
    visualStyle: `Kurumsal ve güven verici. Koyu lacivert, derin bordo veya koyu gri palet. Temiz ofis, kitaplık, adalet sembolü. Yüksek kalite portré fotoğrafçılığı. Hiçbir zaman karikatür veya oyunbaz görsel.`,
    complianceWarnings: `Her içeriğin altına "Bu paylaşım hukuki tavsiye niteliği taşımaz, danışmanınıza başvurun" notu eklenebilir.`,
    trendSources: [
      { identifier: "https://www.law.com/therecorder" },
      { identifier: "https://abovethelaw.com" },
      { identifier: "https://www.hukuki.net" },
    ],
  },

  [INDUSTRY.REAL_ESTATE]: {
    nameTR: "Gayrimenkul",
    strategyContext: `Gayrimenkul sektöründe içerik; potansiyel alıcı/kiracıda "bu benim evim" hissini yaratmalı, konum ve yaşam tarzı değerini ön plana çıkarmalıdır.`,
    contentRules: `SEKTÖR: Gayrimenkul
- "Bu evde hayatınız nasıl olurdu" — yaşam tarzı anlatısı ürün özelliğinden güçlüdür
- Konum avantajı, mahalle hikayesi, çevre değerleri içerik sütunu oluşturur
- Piyasa raporu, "şu an doğru zaman mı" içerikleri karar aşamasındaki alıcılara ulaşır
- Tur videosu, drone çekimi, iç mekan detayı görsel olarak kritiktir
- KAÇIN: sadece m² ve fiyat listesi, jenerik "hayalinizdeki ev" ifadesi`,
    visualStyle: `Mimari fotoğrafçılık kalitesi. Geniş açı iç mekan, altın saat dış cephe. Temiz, ışıklı, yaşanabilir his. Drone görüntüsü konum değerini gösterir. Staging (ev düzenleme) ile sıcak yaşam atmosferi.`,
    trendSources: [
      { identifier: "https://www.propertywire.com" },
      { identifier: "https://www.hurriyetemlak.com/blog" },
      { identifier: "https://www.realtor.com/news/real-estate-news" },
    ],
  },

  [INDUSTRY.BEAUTY]: {
    nameTR: "Güzellik / Kozmetik / Kuaför",
    strategyContext: `Güzellik sektöründe içerik; dönüşüm (before/after), ürün deneyimi ve güzelliğin kişisel ifade aracı olduğu anlatısı üzerine kuruludur. Topluluk ve kullanıcı içeriği kritiktir.`,
    contentRules: `SEKTÖR: Güzellik / Kozmetik / Kuaför
- Before/after dönüşüm (izinli) en yüksek etkileşim formatıdır
- "Nasıl uygulanır" tutorial içeriği ürün satışını destekler
- İçerik sahibinin özgün kullanımı (UGC tarzı) güven sağlar
- Trend renk/teknik → marka ürünüyle bağlantı kurma
- KAÇIN: Photoshop ile abartılı cilt düzeltmesi, gerçekçi olmayan dönüşüm vaadi`,
    visualStyle: `Parlak, temiz, yüksek saturasyon. Makro ürün çekimi, cilt dokusu detayı. Pastel veya canlı renk paleti — marka kimliğine göre. Simetrik flat-lay düzenlemesi. Model çekiminde doğal ışık ve minimal retuş.`,
    complianceWarnings: `"Medikal" sonuç vaatlerinden kaçın (cilt hastalığı tedavisi gibi). İçerik kişisel bakım ürünü sınırında kalmalı.`,
    trendSources: [
      { identifier: "https://www.allure.com/beauty/skin-care" },
      { identifier: "https://www.beautyindependent.com" },
      { identifier: "https://www.cosmeticsdesign.com" },
    ],
  },

  [INDUSTRY.EDUCATION]: {
    nameTR: "Eğitim / Kurs / Akademi",
    strategyContext: `Eğitim sektöründe içerik; dönüşüm/başarı hikayeleri, öğrenme merakını uyandıracak micro-içerikler ve sertifika/kariyer değeri anlatısı üzerine kurulur.`,
    contentRules: `SEKTÖR: Eğitim / Kurs / Akademi
- "Bu bilgiyi bilmiyor muydunuz?" → merak uyandıran micro-öğretim formatı işe yarar
- Mezun/öğrenci başarı hikayesi dönüşüm sağlar — somut kariyer çıktısı ile
- "Neden bu beceri şart?" — kariyer bağlantısı satın alma kararını hızlandırır
- Eğitmen uzmanlığını gösteren içerik güven inşa eder
- KAÇIN: "aç kalma kurs al" baskı satış dili, içi boş motivasyon postları`,
    visualStyle: `Aydınlık, açık ve ilham verici. Öğrenme ortamı (laptop, defter, sınıf), insan odaklı. Temiz tipografi ile bilgi vurgusu. Infografik ve slide-style formatlar etkilidir.`,
    trendSources: [
      { identifier: "https://www.edsurge.com" },
      { identifier: "https://www.educationdive.com" },
      { identifier: "https://techcrunch.com/category/edtech" },
    ],
  },

  [INDUSTRY.HEALTHCARE]: {
    nameTR: "Sağlık / Klinik / Eczane",
    strategyContext: `Sağlık sektöründe dijital içerik; güven, empati ve erişilebilir bilgi sunumu üzerine kurulur. Hasta kaygılarını azaltmak ve bilinçli tercih yapmayı desteklemek önceliktir.`,
    contentRules: `SEKTÖR: Sağlık / Klinik / Eczane
- Sık sorulan soru + basit açıklama formatı hasta adaylarına ulaşır
- "Belirtileri görmezden gelmeyin" → yönlendirme içeriği randevu artırır
- Ekip tanıtımı, tesisin arkası güven inşa eder
- Hasta başarı hikayesi (gizlilik korunarak) en güçlü kanıttır
- KAÇIN: kesin teşhis veya tedavi vaadi, "mucize tedavi" dili`,
    visualStyle: `Temiz, steril ama sıcak. Beyaz ve pastel tonlar. Gülümseyen sağlık profesyoneli. Modern tesis, günışığı. Hasta-doktor etkileşimi doğal ve güven verici görünmeli.`,
    complianceWarnings: `"Kesin iyileşir", "en iyi tedavi" gibi tıbbi vaatlerden kesinlikle kaçın. Ilaç/tedavi önerisi niteliğindeki içeriklerde "hekiminize danışın" ibaresi ekle.`,
    trendSources: [
      { identifier: "https://www.healthline.com/health-news" },
      { identifier: "https://medscape.com" },
      { identifier: "https://www.fiercehealthcare.com" },
    ],
  },

  [INDUSTRY.HOSPITALITY]: {
    nameTR: "Otel / Turizm / Seyahat",
    strategyContext: `Konaklama ve turizm sektöründe içerik; kaçış arzusu, deneyim özlemi ve "orada olmak nasıl hissettiriyor" duygusunu tetiklemek üzerine kuruludur.`,
    contentRules: `SEKTÖR: Otel / Turizm / Seyahat
- "Seni buraya götürsek" — deneyim anlatısı fiyat argümanından güçlüdür
- Yerel kültür, gizli köşe, insider ipucu içerik değeri yüksek
- Sezonluk kampanya, erken rezervasyon aciliyeti yaratır
- Misafir deneyimi / yorum içeriği sosyal kanıttır
- KAÇIN: salt oda özellikleri listesi, "lüks" kelimesinin abartılı kullanımı`,
    visualStyle: `Büyüleyici destinasyon fotoğrafçılığı. Altın saat ışığı, drone panorama, su yansıması. Otel iç mekanında ambiyans ve detay. İnsan figürü: küçük, sahneye ölçek katar. Renk: sıcak, doğal, özgün.`,
    trendSources: [
      { identifier: "https://skift.com" },
      { identifier: "https://www.traveldailymedia.com" },
      { identifier: "https://www.phocuswire.com" },
    ],
  },

  [INDUSTRY.ECOMMERCE]: {
    nameTR: "E-Ticaret (Genel)",
    strategyContext: `Genel e-ticaret markalarında içerik; ürün keşfini kolaylaştırmalı, satın alma engelini azaltmalı ve marka sadakati inşa etmelidir. Platform ve dönüşüm odaklı yaklaşım kritiktir.`,
    contentRules: `SEKTÖR: E-Ticaret
- Ürün kullanım sahnesi gerçekçi bağlam yaratır — stüdyo fotoğrafından güçlüdür
- "Bu ürün hangi problemi çözüyor" formatı dönüşüm sağlar
- Müşteri yorumu + görsel kombinasyonu sosyal kanıt oluşturur
- Flash indirim, sınırlı stok uyarısı aciliyet yaratır
- KAÇIN: sadece beyaz arka plan ürün fotoğrafı postu, anlamsız "yeni sezon" duyurusu`,
    visualStyle: `Ürün hero shot: lifestyle ortamda kullanım sahnesi. Gerçek insan, gerçek ortam. Renk: marka paletine uygun. Flat-lay düzenlemesi ürün kombinasyonları için. Minimal tipografi ile fiyat/fayda vurgusu.`,
    trendSources: [
      { identifier: "https://www.practicalecommerce.com" },
      { identifier: "https://www.shopify.com/blog" },
      { identifier: "https://techcrunch.com/category/e-commerce" },
    ],
  },

  [INDUSTRY.AUTOMOTIVE]: {
    nameTR: "Otomotiv / Araç",
    strategyContext: `Otomotiv sektöründe içerik; güç, özgürlük, prestij ve teknoloji anlatısı üzerine kurulur. Hem duygusal hem teknik alıcıya hitap etmek gerekir.`,
    contentRules: `SEKTÖR: Otomotiv / Araç
- Sürüş deneyimi, özgürlük hissi, yol hikayeleri duygusal bağ kurar
- Teknik özellik karşılaştırması, yakıt/elektrik verimi karar aşamasındaki alıcıya ulaşır
- "Bu araçla nereye giderdiniz?" gibi etkileşim soruları işe yarar
- Bakım ipuçları, mevsimsel uyarılar sahip kitleye değer sağlar
- KAÇIN: sadece teknik spec listesi, jenerik "hayalinizdeki araba" ifadesi`,
    visualStyle: `Dinamik araç fotoğrafçılığı. Hareketli çekim, arka plan bulanık, araç keskin. Altın saat veya dramatik gün batımı. Şehir veya doğa arka planı — marka kişiliğine göre. Detay çekimi: jant, far, iç mekan.`,
    trendSources: [
      { identifier: "https://www.motortrend.com" },
      { identifier: "https://www.caranddriver.com/news" },
      { identifier: "https://electrek.co" },
    ],
  },

  [INDUSTRY.CONSTRUCTION]: {
    nameTR: "İnşaat / Yapı",
    strategyContext: `İnşaat sektöründe sosyal medya; güven, kalite kanıtı ve tamamlanmış proje portföyü üzerine kurulur. B2B ve B2C hedef kitle bir arada olabilir.`,
    contentRules: `SEKTÖR: İnşaat / Yapı
- Tamamlanan proje showcase'i en güçlü içeriktir — before/after çekimleri
- Süreç videosu (temel atma → teslim) şeffaflık ve güven inşa eder
- Sektör bilgisi: deprem yönetmelikleri, malzeme kalitesi, teknik ipuçları uzmanlık gösterir
- Referans müşteri yorumu sosyal kanıttır
- KAÇIN: yarım kalmış proje görseli, teknik jargon dolu açıklama`,
    visualStyle: `Profesyonel mimari fotoğrafçılık. Tamamlanmış yapı, temiz çevre, iyi ışık. Drone panorama konum ve ölçek verir. İç mekan: geniş açı, doğal ışık. Güçlü renk: çelik gri, beton tonu, marka rengi vurgusu.`,
    trendSources: [
      { identifier: "https://www.constructiondive.com" },
      { identifier: "https://www.enr.com/topics/1-news" },
      { identifier: "https://www.arkitera.com" },
    ],
  },

  [INDUSTRY.INTERIOR]: {
    nameTR: "Mimarlık / İç Tasarım",
    strategyContext: `Mimarlık ve iç tasarım sektöründe içerik; estetik ilham, yaşam kalitesi ve "bu mekanı ben tasarlasam" arzusu üzerine kurulur.`,
    contentRules: `SEKTÖR: Mimarlık / İç Tasarım
- "Bu köşeyi nasıl dönüştürdük" before/after formatı en yüksek etkileşim sağlar
- Renk paleti, malzeme seçimi, ışık tasarımı eğitici micro-içerikler işe yarar
- Tamamlanan projenin mimar/tasarımcı anlatısıyla sunumu kişisel bağ kurar
- Trend: minimalizm, Japandi, biyofilik tasarım — sektör trendlerini yakala
- KAÇIN: çok kalabalık görsel, düşük çözünürlüklü çekim`,
    visualStyle: `Editorial iç mekan fotoğrafçılığı. Geniş açı veya detay seçimi. Doğal ışık öncelikli, sıcak ton. Simetri ve geometri vurgusu. Malzeme dokusu yakın çekim. Minimal insan figürü veya hiç yok.`,
    trendSources: [
      { identifier: "https://www.dezeen.com" },
      { identifier: "https://www.archdaily.com" },
      { identifier: "https://www.interiordesign.net/news" },
    ],
  },

  [INDUSTRY.CONSULTING]: {
    nameTR: "Danışmanlık / Muhasebe",
    strategyContext: `Danışmanlık ve muhasebe sektöründe içerik; uzmanlık kanıtı, somut sonuç ve "bu kişi/firma beni anlar" güveni üzerine kurulur. LinkedIn ağırlıklı strateji.`,
    contentRules: `SEKTÖR: Danışmanlık / Muhasebe
- "Müşterimiz X sorunu yaşıyordu, şunu yaptık, sonuç bu oldu" case study formatı dönüşüm sağlar
- Karmaşık konuyu basitleştiren micro-içerik uzmanlık gösterir
- Sektör değişiklikleri (vergi takvimi, yasal düzenlemeler) zamanında paylaşmak değer katar
- LinkedIn thought leadership: piyasa yorumu, sektör gözlemi
- KAÇIN: fiyat listesi postu, "güvenilir danışmanınız" klişesi`,
    visualStyle: `Profesyonel ve temiz. Koyu lacivert veya antrasit palet. Veri görselleştirmesi, infografik. Ekip fotoğrafı doğal ofis ortamında. Tipografi ağırlıklı içerik kartları.`,
    trendSources: [
      { identifier: "https://hbr.org" },
      { identifier: "https://www.mckinsey.com/insights" },
      { identifier: "https://www.accountingtoday.com" },
    ],
  },

  [INDUSTRY.MEDIA]: {
    nameTR: "Medya / Yayıncılık / Prodüksiyon",
    strategyContext: `Medya ve prodüksiyon sektöründe sosyal medya; portföy vitrin, süreç şeffaflığı ve içerik yaratıcılığını ön plana çıkarma üzerine kurulur.`,
    contentRules: `SEKTÖR: Medya / Yayıncılık / Prodüksiyon
- Sahne arkası, çekim süreci, ekip anları özgünlük ve ilgi yaratır
- Tamamlanan proje/yayın lansmanı showcase formatı portföy oluşturur
- Müşteri/yayın başarı hikayesi güven sağlar
- Sektör trendi: yeni formatlar, platform değişiklikleri, algoritma yorumları
- KAÇIN: sadece promosyon içeriği, müşteri logosu sıralama postu`,
    visualStyle: `Dinamik ve yaratıcı. Film grain, sinematik ton, dramatik ışık. Kamera, sahne, ekipman detayı. Renkli ve cesur veya sinematik siyah-beyaz — marka kimliğine göre.`,
    trendSources: [
      { identifier: "https://deadline.com" },
      { identifier: "https://variety.com/v/digital" },
      { identifier: "https://www.streamingmedia.com/News" },
    ],
  },

  [INDUSTRY.AGRICULTURE]: {
    nameTR: "Tarım / Gıda Üretimi",
    strategyContext: `Tarım ve gıda üretimi sektöründe içerik; doğallık, köken hikayesi, sürdürülebilirlik ve "nerede, nasıl üretildi" şeffaflığı üzerine kurulur.`,
    contentRules: `SEKTÖR: Tarım / Gıda Üretimi
- Üretim süreci, tarladan sofraya yolculuk güven ve özgünlük sağlar
- Mevsimsel hasat, doğal döngüler içerik takviminin omurgasıdır
- Çiftçi/üretici hikayesi insanileştirir, duygusal bağ kurar
- Sürdürülebilirlik, organik sertifika, yerel üretim değer anlatısı oluşturur
- KAÇIN: aşırı işlenmiş görsel, doğallıkla çelişen stüdyo fotoğrafı`,
    visualStyle: `Doğal ve otantik. Tarla, toprak, ürün dokusu yakın çekim. Altın saat ışığı. Ham, işlenmemiş estetik — doğallık hissi kritik. Sıcak toprak tonları, yeşil, sarı renk paleti.`,
    trendSources: [
      { identifier: "https://www.agweb.com/news" },
      { identifier: "https://www.foodnavigator.com" },
      { identifier: "https://www.tarimdunyasi.net" },
    ],
  },

  [INDUSTRY.NGO]: {
    nameTR: "Sivil Toplum / STK / Vakıf",
    strategyContext: `STK ve vakıflarda içerik; misyon anlatısı, etki kanıtı ve topluluk mobilizasyonu üzerine kurulur. Duygusal bağ ve şeffaflık güven için kritiktir.`,
    contentRules: `SEKTÖR: Sivil Toplum / STK / Vakıf
- Gerçek faydalanıcı hikayesi (izinli) en güçlü içeriktir
- "Bağışınızla ne oldu" şeffaflık içeriği güven ve tekrar bağış sağlar
- Gönüllü deneyimi, saha anı topluluk hissi yaratır
- Kampanya aciliyeti net ve dürüst olmalı — manipülatif ton kaçınılmalı
- KAÇIN: acı ve yoksulluk pornografisi, manipülatif bağış baskısı`,
    visualStyle: `Umut verici ve insani. Gerçek insanlar, doğal ışık, samimi anlar. Aşırı prodüksiyon yok — otantiklik öncelikli. Marka rengi ile umut vurgusu. Saha fotoğrafı ve etki rakamı kombinasyonu.`,
    complianceWarnings: `Bağış kampanyalarında yasal düzenlemelere uygun dil kullan. Kişisel veri ve çocuk fotoğraflarında gizlilik kurallarına dikkat.`,
    trendSources: [
      { identifier: "https://www.nonprofitpro.com/nonprofit-news" },
      { identifier: "https://ssir.org" },
      { identifier: "https://www.siviltoplum.com" },
    ],
  },

  [INDUSTRY.RETAIL]: {
    nameTR: "Perakende / Market / Mağaza",
    strategyContext: `Perakende sektöründe içerik; ürün keşfi, promosyon aciliyeti ve mağaza deneyimi anlatısı üzerine kurulur. Yerel ve anlık içerik güçlüdür.`,
    contentRules: `SEKTÖR: Perakende / Market / Mağaza
- Haftalık kampanya, indirim, fırsat içerikleri anlık trafik çeker
- Yeni ürün / raf lansmanı merak uyandırır
- "Bu hafta ne aldık" keşif formatı düzenli takipçi oluşturur
- Yerel etkinlik, açılış, mağaza içi an özgünlük sağlar
- KAÇIN: sadece fiyat listesi görseli, düşük kaliteli ürün fotoğrafı`,
    visualStyle: `Parlak ve canlı. Ürün hero shot, mağaza içi düzenleme, renk doygunluğu yüksek. Flat-lay veya lifestyle ürün kullanımı. Fiyat/indirim vurgusu için temiz tipografi.`,
    trendSources: [
      { identifier: "https://www.retaildive.com" },
      { identifier: "https://www.supermarketnews.com" },
      { identifier: "https://perakende.org/haberler" },
    ],
  },

  [INDUSTRY.INSURANCE]: {
    nameTR: "Sigorta / Güvence",
    strategyContext: `Sigorta sektöründe içerik; güven, risk farkındalığı ve "başına gelmeden önce düşün" anlatısı üzerine kurulur. Karmaşık ürünü sade dille anlatmak kritiktir.`,
    contentRules: `SEKTÖR: Sigorta / Güvence
- "Bunu bilmeden sigorta yaptırmayın" eğitici formatı dikkat çeker
- Gerçek hasar/kaza senaryosu (anonim) "olabilir" farkındalığı yaratır
- Poliçe karşılaştırması, teminat açıklaması şeffaflık sağlar
- LinkedIn'de kurumsal risk yönetimi içeriği B2B kitlesine ulaşır
- KAÇIN: korku sömürüsü, "mutlaka başına gelir" dili`,
    visualStyle: `Güven verici ve sakin. Mavi, yeşil, beyaz palet. Aile, ev, araç — korunan değerleri temsil eden görseller. Temiz infografik, net tipografi. Stres değil huzur hissi.`,
    complianceWarnings: `Sigorta teminatları hakkında kesin vaat içeren ifadelerden kaçın. "Poliçe koşullarına tabidir" notu gerekebilir.`,
    trendSources: [
      { identifier: "https://www.insurancejournal.com" },
      { identifier: "https://www.dig-in.com" },
      { identifier: "https://www.sigortagundem.com" },
    ],
  },

  [INDUSTRY.LOGISTICS]: {
    nameTR: "Lojistik / Kargo / Taşımacılık",
    strategyContext: `Lojistik sektöründe içerik; güvenilirlik, hız ve operasyonel mükemmellik kanıtı üzerine kurulur. B2B odaklı LinkedIn ağırlıklı strateji gerektirir.`,
    contentRules: `SEKTÖR: Lojistik / Kargo / Taşımacılık
- Teslimat başarı verisi, hız rekoru, kapsama alanı güven sağlar
- Operasyon arkası: depo, araç filosu, teknoloji şeffaflık yaratır
- Müşteri entegrasyonu hikayesi B2B karar vericiye ulaşır
- Sürdürülebilir lojistik, elektrikli filo içeriği güncel değer sağlar
- KAÇIN: hasar veya gecikme içeriği, müşteri şikayetine duyarsız kalma`,
    visualStyle: `Dinamik ve güçlü. Araç filosu, depo operasyonu, teslimat anı. Mavi-turuncu enerji paleti. Drone çekimi ölçek verir. Veri görselleştirmesi: hız, mesafe, teslimat sayısı.`,
    trendSources: [
      { identifier: "https://www.supplychaindive.com" },
      { identifier: "https://www.freightwaves.com" },
      { identifier: "https://lojistikgazetesi.com" },
    ],
  },

  [INDUSTRY.EVENTS]: {
    nameTR: "Etkinlik / Organizasyon / Düğün",
    strategyContext: `Etkinlik ve organizasyon sektöründe içerik; portföy vitrin, atmosfer anlatısı ve "senin özel günün de bu kadar güzel olabilir" vaadi üzerine kurulur.`,
    contentRules: `SEKTÖR: Etkinlik / Organizasyon / Düğün
- Tamamlanan etkinlik galeri showcase'i en güçlü portföy içeriğidir
- Detay çekimleri: masa düzeni, dekor, ışık — "wow" etkisi yaratır
- Müşteri tepkisi, mutluluk anı sosyal kanıttır
- Süreç içeriği: "Bu organizasyonu nasıl hazırladık" uzmanlık gösterir
- KAÇIN: müşteri iznisiz fotoğraf paylaşımı, rakip kötüleme`,
    visualStyle: `Büyüleyici ve duygusal. Sinematik ışık, bokeh, altın saat. Dekor detayı yakın çekim. Mutlu insan anları. Sıcak ton, romantik veya enerjik — etkinlik tipine göre.`,
    trendSources: [
      { identifier: "https://www.bizbash.com" },
      { identifier: "https://www.specialevents.com/news" },
      { identifier: "https://www.dugunhikayem.com/blog" },
    ],
  },

  [INDUSTRY.PERSONAL_BRAND]: {
    nameTR: "Kişisel Marka / Influencer / Koç",
    strategyContext: `Kişisel markada içerik; otantiklik, uzmanlık paylaşımı ve kişisel dönüşüm anlatısı üzerine kurulur. Takipçi ile birebir ilişki hissi kritiktir.`,
    contentRules: `SEKTÖR: Kişisel Marka / Influencer / Koç
- Kişisel deneyim, hata ve öğrenme hikayesi özgünlük ve bağ kurar
- "Bunu yıllarca yanlış yapıyordum" formatı dikkat çeker
- Expertise paylaşımı: okuyucuyu daha iyi hale getiren micro-içerik
- Günlük/haftalık rutin, sahne arkası insanileştirir
- KAÇIN: aşırı filtrelenmiş/mükemmel görüntü, samimiyetsiz "motivasyon" içeriği`,
    visualStyle: `Otantik ve kişisel. Doğal ışık, minimal prodüksiyon. Gerçek ortam: ev, çalışma masası, kahve. Yüz görünür — güven için. Marka rengi aksan olarak, abartısız.`,
    trendSources: [
      { identifier: "https://www.creatoreconomy.es" },
      { identifier: "https://influencermarketinghub.com/news" },
      { identifier: "https://www.socialmediatoday.com" },
    ],
  },

  [INDUSTRY.GENERAL]: {
    nameTR: "Genel",
    strategyContext: `Sektör belirtilmemiş. Marka verisinden çıkarılan bağlama göre genel sosyal medya stratejisi uygula.`,
    contentRules: `SEKTÖR: Genel
- Marka değerini ve uzmanlığını öne çıkar
- Hedef kitle problemine çözüm sunan içerikler üret
- Sosyal kanıt (müşteri, sonuç) ekle`,
    visualStyle: `Profesyonel ve marka renklerine uygun. Temiz kompozisyon, yüksek kalite.`,
    trendSources: [
      { identifier: "https://www.socialmediatoday.com" },
      { identifier: "https://www.theverge.com/ai-artificial-intelligence" },
      { identifier: "https://techcrunch.com/category/social" },
    ],
  },
};

export function getIndustryConfig(industry: string | null | undefined): IndustryConfig {
  return INDUSTRY_CONFIG[industry ?? INDUSTRY.GENERAL] ?? INDUSTRY_CONFIG[INDUSTRY.GENERAL];
}
