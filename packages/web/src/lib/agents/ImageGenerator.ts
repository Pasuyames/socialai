import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import prisma from "../db";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { POST_STATUS, PLATFORM } from "../constants";

// ─── Görsel Üretim Sağlayıcı Yapılandırması ──────────────────────────────────
// AI Studio anahtarı (GEMINI_API_KEY) varsa onu kullan; yoksa Vertex'e düş.
// Seçili model: Nano Banana 2 (gemini-3.1-flash-image), 2K çözünürlük.
const IMAGE_API_KEY      = process.env.GEMINI_API_KEY;                            // AI Studio anahtarı
const GEMINI_IMAGE_MODEL = process.env.IMAGE_MODEL || "gemini-3.1-flash-image";   // Nano Banana 2
const IMAGE_SIZE         = process.env.IMAGE_SIZE  || "2K";                       // 1K | 2K | 4K

// ─── Çıktı tuval boyutları (px) ──────────────────────────────────────────────
// Feed: tam olarak 4:5 (Instagram portre). Story: 9:16.
// KURAL: Story için ASLA yeni AI üretimi yapılmaz — 4:5 feed görseli kaynak alınıp
// sharp ile (bulanık arka plan genişletme + compositing) 9:16'ya uyarlanır.
const FEED_SIZE  = { w: 1080, h: 1350 }; // 4:5
const STORY_SIZE = { w: 1080, h: 1920 }; // 9:16

// ─── Web public kök dizini ───────────────────────────────────────────────────
// Üretilen görseller web'in serve ettiği public/ altına yazılmalı. Next.js bunu
// process.cwd()/public'te bulur; ANCAK görsel üretimi worker process'inden de
// (farklı cwd: packages/worker) tetiklenebilir. O yüzden PUBLIC_DIR env'i öncelikli
// kullanılır → görseller her zaman web'in public/'ine düşer, URL'ler (/uploads/...)
// her iki bağlamda da tutarlı kalır.
function publicDir(): string {
  return process.env.PUBLIC_DIR
    ? path.resolve(process.env.PUBLIC_DIR)
    : path.join(process.cwd(), "public");
}

export class ImageGeneratorAgent {
  private agentName = "Image Generator (Görsel Üretici — Nano Banana 2)";

  async execute(postId: number): Promise<boolean> {
    try {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: { plan: { include: { brand: true } } },
      });

      if (!post?.imagePrompt && !post?.productImagePath) {
        await this.log(postId, "HATA: Görsel prompt veya ürün görseli yok. PromptEngineer önce çalışmalı.");
        return false;
      }

      const platform  = post.platform ?? PLATFORM.INSTAGRAM;
      const root      = publicDir();
      const uploadDir = path.join(root, "uploads");
      await fs.promises.mkdir(uploadDir, { recursive: true });

      const ai = this.makeClient();

      // ── 1) FEED görseli (tam 4:5) üret ────────────────────────────────────
      let feedPath: string;
      const productAbs = post.productImagePath
        ? path.join(root, post.productImagePath.replace(/^\//, ""))
        : null;

      if (productAbs && fs.existsSync(productAbs)) {
        // ÜRÜN MODU: gerçek paketi REFERANS verip sahneye render ettir.
        // Referanslı üretim başarısız olursa sharp compositing'e (gradient kart) düşer.
        const scene = post.imagePrompt ?? "professional lifestyle product photography, soft natural light, rustic surface";
        try {
          await this.log(postId, `${GEMINI_IMAGE_MODEL} ile ürün referanslı feed (4:5) üretiliyor...`);
          feedPath = await this.generateWithProductReference(ai, productAbs, scene, uploadDir);
        } catch (refErr: any) {
          await this.log(postId, `Referanslı üretim başarısız (${refErr.message?.slice(0, 80)}) — compositing'e düşülüyor.`);
          const colors = this.brandTints(post.plan.brand.visualIdentity);
          feedPath = await this.composeProductCard(productAbs, FEED_SIZE, colors, uploadDir);
        }
      } else {
        // STANDART MOD: Nano Banana 2 metin→görsel (4:5).
        if (post.productImagePath) {
          await this.log(postId, `UYARI: Ürün görseli bulunamadı (${post.productImagePath}) — metin→görsele düşülüyor.`);
        }
        if (!post.imagePrompt) throw new Error("Görsel prompt yok.");
        await this.log(postId, `${GEMINI_IMAGE_MODEL} (${IMAGE_SIZE}) ile feed (4:5) üretiliyor...`);
        feedPath = await this.generateTextToImage(ai, post.imagePrompt, uploadDir);
      }

      // ── 2) STORY (9:16): feed'i kaynak alıp sharp ile uyarla (yeni AI YOK) ──
      let storyPath: string | null = null;
      if (platform === PLATFORM.INSTAGRAM) {
        storyPath = await this.adaptFeedToStory(feedPath, uploadDir);
      }

      // ── 3) Kaydet ──────────────────────────────────────────────────────────
      await prisma.post.update({
        where: { id: postId },
        data: {
          imagePath:      `/uploads/${path.basename(feedPath)}`,
          storyImagePath: storyPath ? `/uploads/${path.basename(storyPath)}` : null,
          status:         POST_STATUS.QC_REVIEW,
        },
      });

      await this.log(
        postId,
        `Görsel hazır. Feed 4:5: ${path.basename(feedPath)}` +
          (storyPath ? ` | Story 9:16 (feed'den türetildi): ${path.basename(storyPath)}` : ""),
      );
      return true;

    } catch (err: any) {
      await this.log(postId, `BAŞARISIZ: ${err.message}`);
      return false;
    }
  }

  // AI Studio anahtarı varsa onu kullan (Nano Banana 2 erişimi); yoksa Vertex'e düş.
  private makeClient(): GoogleGenAI {
    if (IMAGE_API_KEY) return new GoogleGenAI({ apiKey: IMAGE_API_KEY });
    const project  = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_LOCATION || "us-central1";
    if (!project) throw new Error("GCP_PROJECT_ID veya GEMINI_API_KEY env değişkeni gerekli.");
    return new GoogleGenAI({ vertexai: true, project, location });
  }

  // ─── Ürün Referanslı Üretim (Nano Banana 2) — feed 4:5 ────────────────────
  // Gerçek paket görselini referans verip sahneye fotorealistik render ettirir.
  // Çıktı 4:5 feed boyutuna (sharp cover-fit) tam oturtulur.
  private async generateWithProductReference(
    ai: GoogleGenAI,
    productAbs: string,
    scene: string,
    uploadDir: string,
  ): Promise<string> {
    const bytes = await fs.promises.readFile(productAbs);
    const ext   = path.extname(productAbs).toLowerCase();
    const mime  = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/webp";

    const instruction =
      `Use the provided product package as the EXACT hero product — preserve its packaging design, label, colors and text precisely (do not redesign or relabel it). ` +
      `Render a photorealistic, professional commercial lifestyle photograph placing this real product naturally into the following scene: ${scene}. ` +
      `The product must be the clear focal point, well-lit and sharp. Vertical 4:5 feed composition, appetizing and on-brand. No extra text, no watermark, no duplicate products.`;

    const res: any = await ai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType: mime, data: bytes.toString("base64") } },
          { text: instruction },
        ],
      }],
      config: { responseModalities: ["IMAGE"], imageConfig: { imageSize: IMAGE_SIZE } },
    });

    const parts   = res.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p: any) => p.inlineData?.data);
    if (!imgPart) throw new Error("Nano Banana 2 görsel döndürmedi.");

    return this.saveFitted(imgPart.inlineData.data, FEED_SIZE, "product", uploadDir);
  }

  // ─── Nano Banana 2 Metin→Görsel — feed 4:5 ────────────────────────────────
  // Referans görsel olmadan, prompt'tan doğrudan 4:5 feed görseli üretir.
  private async generateTextToImage(
    ai: GoogleGenAI,
    prompt: string,
    uploadDir: string,
  ): Promise<string> {
    const res: any = await ai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: [{
        role: "user",
        parts: [{ text: `${prompt}. Vertical 4:5 feed composition, photorealistic, high detail. No text, no watermark.` }],
      }],
      config: { responseModalities: ["IMAGE"], imageConfig: { imageSize: IMAGE_SIZE } },
    });

    const parts   = res.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p: any) => p.inlineData?.data);
    if (!imgPart) throw new Error("Nano Banana 2 görsel döndürmedi.");

    return this.saveFitted(imgPart.inlineData.data, FEED_SIZE, "scene", uploadDir);
  }

  // base64 görseli hedef orana (cover-fit) oturtup JPEG olarak kaydeder.
  private async saveFitted(
    b64: string,
    size: { w: number; h: number },
    prefix: string,
    uploadDir: string,
  ): Promise<string> {
    const fitted = await sharp(Buffer.from(b64, "base64"))
      .resize({ width: size.w, height: size.h, fit: "cover", position: "attention" })
      .jpeg({ quality: 90 })
      .toBuffer();

    const name     = `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.jpg`;
    const filePath = path.join(uploadDir, name);
    await fs.promises.writeFile(filePath, fitted);
    return filePath;
  }

  // ─── Story (9:16) — feed görselinden türetme (sharp, AI YOK) ──────────────
  // 4:5 feed'i kaynak alır; arka planı feed'in bulanık-büyütülmüş kopyasıyla
  // 9:16'ya genişletir, orijinal feed'i dikeyde ortaya net olarak yerleştirir.
  private async adaptFeedToStory(feedPath: string, uploadDir: string): Promise<string> {
    const { w, h } = STORY_SIZE; // 1080x1920
    const feedBuf  = await fs.promises.readFile(feedPath);

    // Arka plan: feed'i story tuvaline cover-fit + bulanıklaştır + hafif karart
    const background = await sharp(feedBuf)
      .resize({ width: w, height: h, fit: "cover", position: "attention" })
      .blur(36)
      .modulate({ brightness: 0.82 })
      .toBuffer();

    // Ön plan: orijinal feed tam genişlikte (1080) — 4:5 oranı korunur (1080x1350)
    const foreground = await sharp(feedBuf).resize({ width: w }).toBuffer();
    const fgMeta = await sharp(foreground).metadata();
    const top    = Math.max(0, Math.round((h - (fgMeta.height ?? FEED_SIZE.h)) / 2));

    const out = await sharp(background)
      .composite([{ input: foreground, top, left: 0 }])
      .jpeg({ quality: 90 })
      .toBuffer();

    const name     = `story-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.jpg`;
    const filePath = path.join(uploadDir, name);
    await fs.promises.writeFile(filePath, out);
    return filePath;
  }

  // ─── Ürün Kartı Compositing (fallback) ────────────────────────────────────
  // Gerçek paket mockup'ını (beyaz zeminli) açık marka gradyanına yerleştirir.
  // Beyaz mockup zemini açık gradyana kaynaşır → kenar/kutu görünmez.

  private async composeProductCard(
    productAbs: string,
    size: { w: number; h: number },
    colors: { top: string; bottom: string },
    uploadDir: string,
  ): Promise<string> {
    const { w, h } = size;

    // Açık marka gradyanı (SVG → raster)
    const bgSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${colors.top}"/>
            <stop offset="100%" stop-color="${colors.bottom}"/>
          </linearGradient>
          <radialGradient id="v" cx="50%" cy="42%" r="70%">
            <stop offset="60%" stop-color="#000000" stop-opacity="0"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0.06"/>
          </radialGradient>
        </defs>
        <rect width="${w}" height="${h}" fill="url(#g)"/>
        <rect width="${w}" height="${h}" fill="url(#v)"/>
      </svg>`,
    );

    // Paketi tuvalin ~%72 genişliğine ölçekle, oranı koru
    const targetW = Math.round(w * 0.72);
    const product = await sharp(productAbs)
      .resize({ width: targetW, withoutEnlargement: false })
      .toBuffer();
    const meta = await sharp(product).metadata();
    const prodH = meta.height ?? Math.round(targetW * 1.2);

    // Yatayda ortala, dikeyde hafif üstte (görsel denge)
    const left = Math.round((w - targetW) / 2);
    const top  = Math.round((h - prodH) / 2 * 0.92);

    const name = `product-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.jpg`;
    const filePath = path.join(uploadDir, name);

    await sharp(bgSvg)
      .composite([{ input: product, top: Math.max(0, top), left: Math.max(0, left) }])
      .jpeg({ quality: 90 })
      .toFile(filePath);

    return filePath;
  }

  // visualIdentity renk paletinden açık iki tint üretir (beyaza yakın).
  private brandTints(visualIdentity: string | null): { top: string; bottom: string } {
    const fallback = { top: "#FFFFFF", bottom: "#F3EDE3" }; // beyaz → açık krem
    if (!visualIdentity) return fallback;
    try {
      const v = JSON.parse(visualIdentity);
      const palettes = v.colorPalettes as Array<{ hex?: string }> | undefined;
      const hex = palettes?.map(p => p.hex).find(h => typeof h === "string" && /^#?[0-9a-fA-F]{6}$/.test(h));
      if (!hex) return fallback;
      const tint = this.mixWithWhite(hex, 0.82); // %82 beyaz → açık tint
      return { top: "#FFFFFF", bottom: tint };
    } catch {
      return fallback;
    }
  }

  // hex rengi beyazla karıştırır (amount = beyaz oranı 0..1)
  private mixWithWhite(hex: string, amount: number): string {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const mix = (c: number) => Math.round(c + (255 - c) * amount);
    const toHex = (c: number) => c.toString(16).padStart(2, "0");
    return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
  }

  private async log(postId: number, action: string): Promise<void> {
    await prisma.agentLog.create({
      data: { agentName: this.agentName, action, targetType: "Post", targetId: postId },
    });
  }
}
