import { z } from "zod";
import { generateJSON } from "../llm";
import prisma from "../db";
import { POST_STATUS, PLATFORM } from "../constants";
import { getIndustryConfig } from "../constants/industries";
import { getBrandContext } from "../memory";
import { matchProduct, buildVisualSignature, type ProductInfo } from "../scrapers/ProductCatalog";
import { cleanAgentError } from "../agentError";

// ─── Şema ─────────────────────────────────────────────────────────────────────

const ImagePromptSchema = z.object({
  imagePrompt:    z.string().min(30),
  negativePrompt: z.string().min(10),
  aspectRatio:    z.enum(["1:1", "3:4", "9:16", "16:9", "4:3"]),
});

const PromptScoreSchema = z.object({
  score:          z.number().int().min(0).max(100),
  subjectClarity: z.number().int().min(0).max(25),
  brandAlignment: z.number().int().min(0).max(25),
  technicalSpec:  z.number().int().min(0).max(25),
  platformFit:    z.number().int().min(0).max(25),
  improvements:   z.array(z.string()).max(3),
});

const PROMPT_SCORE_THRESHOLD = 70;
const MAX_PROMPT_RETRIES     = 2;

// Platform bazlı varsayılan aspect ratio (Imagen 3 desteklenen: 1:1, 9:16, 16:9, 3:4, 4:3)
const PLATFORM_RATIO: Record<string, "1:1" | "3:4" | "9:16" | "16:9"> = {
  [PLATFORM.INSTAGRAM]: "3:4",  // 4:5 desteklenmiyor, 3:4 kullan
  [PLATFORM.LINKEDIN]:  "16:9",
  [PLATFORM.TWITTER]:   "16:9",
};

// ─── Ajan ─────────────────────────────────────────────────────────────────────

export class PromptEngineerAgent {
  private agentName = "Prompt Engineer (Görsel Sanat Yönetmeni)";

  async execute(postId: number): Promise<boolean> {
    try {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: { plan: { include: { brand: true } } },
      });

      if (!post?.caption) {
        await this.log(postId, "HATA: Caption bulunamadı.");
        return false;
      }

      await this.log(postId, "Imagen AI için görsel prompt yazımı başlatıldı...");

      const brand    = post.plan.brand;
      const platform = post.platform ?? PLATFORM.INSTAGRAM;

      let strategy: any = {};
      let visual: any   = {};
      let catalog: ProductInfo[] = [];
      try {
        if (brand.brandStrategy) strategy = JSON.parse(brand.brandStrategy);
        if (brand.visualIdentity) visual  = JSON.parse(brand.visualIdentity);
        if (brand.rawScrapedData) {
          const scraped = JSON.parse(brand.rawScrapedData);
          if (Array.isArray(scraped.productCatalog)) catalog = scraped.productCatalog;
        }
      } catch { /* ignore */ }

      // Postu gerçek bir ürünle eşleştir — eşleşirse o ürünün paket görseli
      // ImageGenerator'da sahneye birleştirilir (sahte paket yerine gerçeği).
      const matchText = [post.topic, post.concept, post.caption].filter(Boolean).join(" ");
      const matched   = matchProduct(matchText, catalog);
      const productImagePath = matched?.localImagePath ?? null;
      if (matched) {
        await this.log(postId, `Ürün eşleşti: "${matched.name}" — gerçek paket görseli kullanılacak.`);
      }

      // Tüm ürünlerin görsel analizinden marka estetiği özeti (ürün eşleşmese de kullanılır)
      const visualSignature = buildVisualSignature(catalog);

      const industryConfig = getIndustryConfig((brand as any).industry);
      const brandContext   = await getBrandContext(brand.id);
      const basePrompt     = this.buildPrompt(brand.name, post, strategy, visual, platform, industryConfig.visualStyle, brandContext, matched, visualSignature);

      // ─── DSPy Tarzı Self-Assessment Döngüsü ──────────────────────────────
      // Üretilen prompt puanlanır; 70 altındaysa geliştirme notlarıyla yeniden üretilir
      let prompt      = basePrompt;
      let bestResult  = await generateJSON(prompt, ImagePromptSchema, { tier: "balanced", taskName: this.agentName });
      let bestScore   = 0;

      for (let attempt = 1; attempt <= MAX_PROMPT_RETRIES; attempt++) {
        const scored = await this.scorePrompt(bestResult.imagePrompt, platform, brand.name).catch(() => null);
        if (!scored) break;

        await this.log(postId, `Prompt kalite puanı (deneme ${attempt}): ${scored.score}/100`);

        if (scored.score > bestScore) {
          bestScore = scored.score;
        }

        if (scored.score >= PROMPT_SCORE_THRESHOLD || attempt === MAX_PROMPT_RETRIES) break;

        // Eşiğin altındaysa geliştirme notlarıyla yeniden üret
        prompt = `${basePrompt}

ÖNCEKİ DENEME PROMPT PUANI: ${scored.score}/100 — YETERSİZ.
GELİŞTİRME GEREKSİNİMLERİ:
${scored.improvements.map(i => `- ${i}`).join("\n")}

Bu sorunları gidererek daha güçlü, marka kimliğine daha uyumlu bir imagePrompt yaz.`;

        const improved = await generateJSON(prompt, ImagePromptSchema, { tier: "balanced", taskName: this.agentName });
        const newScore = await this.scorePrompt(improved.imagePrompt, platform, brand.name).catch(() => null);

        if (newScore && newScore.score > bestScore) {
          bestResult = improved;
          bestScore  = newScore.score;
        }
      }

      const scoreNote = bestScore > 0 ? ` (prompt kalitesi: ${bestScore}/100)` : "";

      await prisma.post.update({
        where: { id: postId },
        data: {
          imagePrompt:      bestResult.imagePrompt,
          negativePrompt:   bestResult.negativePrompt,
          productImagePath: productImagePath,
          status:           POST_STATUS.IMAGE_PROMPT_READY,
        },
      });

      await this.log(postId, `Görsel prompt hazır (${bestResult.aspectRatio})${scoreNote}${productImagePath ? " [gerçek ürün paketi eklenecek]" : ""}.`);
      return true;

    } catch (err: any) {
      await this.log(postId, `BAŞARISIZ: ${cleanAgentError(err)}`);
      return false;
    }
  }

  // ─── Prompt ───────────────────────────────────────────────────────────────

  private buildPrompt(
    brandName: string,
    post: any,
    strategy: any,
    visual: any,
    platform: string,
    industryVisualStyle: string,
    brandContext = "",
    matched: ProductInfo | null = null,
    visualSignature: string | null = null,
  ): string {
    const archetype      = strategy.brandArchetype ?? "Modern";
    const stylePhrase    = visual.imagenStylePhrase ?? "";
    const colorPalettes  = (visual.colorPalettes as any[] | undefined)
      ?.map((c: any) => `${c.name} (${c.hex})`)
      .join(", ") ?? "";
    const moodKeywords   = (visual.moodKeywords as string[] | undefined)?.join(", ") ?? "";
    const negElements    = (visual.negativeElements as string[] | undefined)?.join(", ") ?? "";
    const composRules    = (visual.compositionRules as string[] | undefined)?.join("; ") ?? "";
    const recStyle       = visual.recommendedStyle ?? "";
    const concept        = post.concept ?? "";
    const topicText      = post.topic   ?? "";
    const preferredRatio = PLATFORM_RATIO[platform] ?? "4:5";
    const inspirationStyle = post.inspirationStyle ?? "";

    // Ürün eşleştiyse: gerçek paket görseli sahneye SONRADAN birleştirilecek.
    // Bu yüzden Imagen'den paketin DURACAĞI boş, doğal bir ARKA PLAN SAHNESİ istiyoruz —
    // sahte/uydurma bir ambalaj çizmesini engelliyoruz.
    // Ürünün görsel hafızası (Gemini Vision'ın daha önce çıkardığı paket analizi)
    const va = matched?.visualAnalysis;
    const productMemory = va
      ? `\nÜRÜN GÖRSEL HAFIZASI (paket analizi — sahne bununla UYUMLU olmalı):
- Ambalaj: ${va.packaging}
- Baskın renkler: ${va.dominantColors?.join(", ")}
- Mood: ${va.mood}
- Paket öğeleri: ${va.depicts}
→ Arka plan paletini ve atmosferi bu paketle uyumlu kur (renkler çakışmasın, ürün öne çıksın).`
      : "";

    const productMode = matched
      ? `
⚠️ ÜRÜN BİRLEŞTİRME MODU — "${matched.name}"
Bu görselde GERÇEK ürün paketi fotoğrafı sahnenin MERKEZİNE sonradan yerleştirilecek.
GÖREVİN: paketin üzerine oturacağı boş, doğal bir ARKA PLAN SAHNESİ tarif et.
- Sahne ortasında ürünün durabileceği NET, BOŞ bir yüzey/alan bırak (negative space, empty center).
- KESİNLİKLE paket/ambalaj/şişe/kutu/etiket/yazı ÇİZME — merkez boş kalmalı.
- İçeriğe uygun atmosfer: ham malzemeler (örn. badem, fındık, kakao), ahşap tezgah, mutfak dokuları kenarlarda.
- Yumuşak doğal ışık, sığ alan derinliği, sıcak ve iştah açıcı.${productMemory}
`
      : "";

    const subjectExample = matched
      ? `empty rustic wooden kitchen counter with soft natural light, scattered raw ingredients (almonds, seeds) around the edges, clean empty space in the center for product placement, warm appetizing atmosphere, shallow depth of field, photorealistic, 8k`
      : `professional product photography, [describe main subject from concept], [setting], cinematic lighting, shallow depth of field, [brand color palette], photorealistic, highly detailed, 8k resolution, award-winning commercial photography`;

    const negExample = matched
      ? `any packaging, any product box, any bottle, any label, any text, any logo, busy center, clutter in center, ${negElements || "blurry, low quality"}`
      : `blurry, low quality, stock photo clichés, watermark, text overlay, people shaking hands, generic office, ugly, deformed, ${negElements || "low resolution, amateur photo"}`;

    return `Sen Imagen AI için uzmanlaşmış bir Sanat Yönetmenisin (Art Director).
${brandContext ? `\n${brandContext}\n` : ""}
Marka kimliğine ve görsel kimliğine tam uyarak Imagen'e verilecek profesyonel bir görsel prompt yaz.
${productMode}
MARKA: ${brandName}
PLATFORM: ${platform.toUpperCase()}
ARKETİP: ${archetype}
KONU: ${topicText}
GÖRSEL KONSEPT (IdeationSpecialist'ten): ${concept || "Bağımsız oluştur"}

SEKTÖR GÖRSEL STİLİ: ${industryVisualStyle}
${inspirationStyle ? `\nGÖRSEL İLHAM ANALİZİ (Pinterest/Unsplash'tan benzer içerikler incelendi):\n${inspirationStyle}\n` : ""}
GÖRSEL KİMLİK:
- Stil Tanımı: ${stylePhrase || recStyle || "Modern, clean, professional"}
- Renk Paleti: ${colorPalettes || "Marka renklerine uygun"}
- Mood: ${moodKeywords || "Professional, trustworthy"}
- Kompozisyon Kuralları: ${composRules || "Rule of thirds"}
- ASLA KULLANILMAYACAK elementler: ${negElements || "Stock photo clichés, blurry images"}
${visualSignature ? `\nMARKA ÜRÜN ESTETİĞİ (gerçek ürün paketlerinden öğrenildi — feed tutarlılığı için sahneyi buna yaklaştır):\n${visualSignature}\n` : ""}

VARSAYILAN ASPECT RATIO: ${preferredRatio}

Imagen için kurallı format:
- imagePrompt: İngilizce, virgüllerle ayrılmış; [Subject], [Setting], [Lighting], [Camera], [Style], [Quality modifiers] sırası
- negativePrompt: İngilizce; çirkin, bozuk, stok fotoğraf klişeleri, marka kimliğine ters elementler
- aspectRatio: "${preferredRatio}" veya içeriğe daha uygun bir oran

SADECE JSON dön:

{
  "imagePrompt": "${subjectExample}",
  "negativePrompt": "${negExample}",
  "aspectRatio": "${preferredRatio}"
}`;
  }

  // ─── Prompt Kalite Değerlendirici ─────────────────────────────────────────
  // DSPy MIPROv2 ilkelerine dayalı 4 boyutlu puanlama (her biri 0-25):
  // subjectClarity, brandAlignment, technicalSpec, platformFit

  private async scorePrompt(
    imagePrompt: string,
    platform: string,
    brandName: string,
  ): Promise<z.infer<typeof PromptScoreSchema>> {
    const scorePrompt = `Sen bir Imagen AI prompt kalite değerlendiricisisin.
Aşağıdaki görsel promptu 4 boyutta puanla (her biri 0-25, toplam 100):

MARKA: ${brandName}
PLATFORM: ${platform.toUpperCase()}

PROMPT:
"""
${imagePrompt.slice(0, 500)}
"""

PUANLAMA KRİTERLERİ:
- subjectClarity (0-25): Ana konu ve kompozisyon net ve spesifik mi?
- brandAlignment (0-25): Marka kimliği, renk paleti ve tonu yansıtıyor mu?
- technicalSpec (0-25): Işık, kamera açısı, kalite modifiers eksiksiz mi?
- platformFit (0-25): ${platform} için uygun format, oran ve estetik mi?

score = subjectClarity + brandAlignment + technicalSpec + platformFit

SADECE JSON dön:
{
  "score": <toplam 0-100>,
  "subjectClarity": <0-25>,
  "brandAlignment": <0-25>,
  "technicalSpec": <0-25>,
  "platformFit": <0-25>,
  "improvements": ["geliştirilmesi gereken 1-3 spesifik nokta"]
}`;

    return generateJSON(scorePrompt, PromptScoreSchema, {
      tier: "fast",
      taskName: `${this.agentName}:Scorer`,
    });
  }

  // ─── Yardımcı ─────────────────────────────────────────────────────────────

  private async log(postId: number, action: string): Promise<void> {
    await prisma.agentLog.create({
      data: { agentName: this.agentName, action, targetType: "Post", targetId: postId },
    });
  }
}
