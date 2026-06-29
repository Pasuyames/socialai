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
const IMAGE_API_KEY     = process.env.GEMINI_API_KEY;                              // AI Studio anahtarı
const GEMINI_IMAGE_MODEL = process.env.IMAGE_MODEL || "gemini-3.1-flash-image";    // Nano Banana 2
const IMAGE_SIZE        = process.env.IMAGE_SIZE  || "2K";                         // 1K | 2K | 4K

// Compositing tuval boyutları (px)
const FEED_SIZE  = { w: 1080, h: 1440 }; // 3:4
const STORY_SIZE = { w: 1080, h: 1920 }; // 9:16

export class ImageGeneratorAgent {
  private agentName = "Image Generator (Görsel Üretici — Imagen 3)";

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
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      await fs.promises.mkdir(uploadDir, { recursive: true });

      // AI Studio anahtarı varsa onu kullan (Nano Banana 2 erişimi); yoksa Vertex
      let ai: GoogleGenAI;
      if (IMAGE_API_KEY) {
        ai = new GoogleGenAI({ apiKey: IMAGE_API_KEY });
      } else {
        const project  = process.env.GCP_PROJECT_ID;
        const location = process.env.GCP_LOCATION || "us-central1";
        if (!project) throw new Error("GCP_PROJECT_ID veya GEMINI_API_KEY env değişkeni gerekli.");
        ai = new GoogleGenAI({ vertexai: true, project, location });
      }

      // ─── ÜRÜN MODU: Gerçek paketi REFERANS verip sahneye render ettir ───────
      // Gemini 2.5 Flash Image gerçek paket görselini görerek sahneye yerleştirir.
      // Başarısız olursa sharp compositing'e (gradient kart) düşer — yine gerçek ürün.
      if (post.productImagePath) {
        const productAbs = path.join(process.cwd(), "public", post.productImagePath.replace(/^\//, ""));
        if (fs.existsSync(productAbs)) {
          const scene = post.imagePrompt ?? "professional lifestyle product photography, soft natural light, rustic surface";
          try {
            await this.log(postId, "Gemini 2.5 Flash Image ile ürün referanslı sahne üretiliyor...");
            const feedPath  = await this.generateWithProductReference(ai, productAbs, scene, FEED_SIZE,  "vertical 3:4 feed", uploadDir);
            const storyPath = platform === PLATFORM.INSTAGRAM
              ? await this.generateWithProductReference(ai, productAbs, scene, STORY_SIZE, "vertical 9:16 story", uploadDir)
              : null;

            await prisma.post.update({
              where: { id: postId },
              data: {
                imagePath:      `/uploads/${path.basename(feedPath)}`,
                storyImagePath: storyPath ? `/uploads/${path.basename(storyPath)}` : null,
                status:         POST_STATUS.QC_REVIEW,
              },
            });
            await this.log(postId, `Ürün referanslı görsel üretildi (Gemini). Feed: ${path.basename(feedPath)}${storyPath ? ` | Story: ${path.basename(storyPath)}` : ""}`);
            return true;
          } catch (refErr: any) {
            await this.log(postId, `Gemini referanslı üretim başarısız (${refErr.message?.slice(0, 80)}) — compositing'e düşülüyor.`);
            const colors = this.brandTints(post.plan.brand.visualIdentity);
            const feedPath  = await this.composeProductCard(productAbs, FEED_SIZE, colors, uploadDir);
            const storyPath = platform === PLATFORM.INSTAGRAM
              ? await this.composeProductCard(productAbs, STORY_SIZE, colors, uploadDir)
              : null;
            await prisma.post.update({
              where: { id: postId },
              data: {
                imagePath:      `/uploads/${path.basename(feedPath)}`,
                storyImagePath: storyPath ? `/uploads/${path.basename(storyPath)}` : null,
                status:         POST_STATUS.QC_REVIEW,
              },
            });
            await this.log(postId, `Gerçek ürün paketi yerleştirildi (compositing fallback).`);
            return true;
          }
        }
        await this.log(postId, `UYARI: Ürün görseli bulunamadı (${post.productImagePath}) — Imagen'e düşülüyor.`);
      }

      // ─── STANDART MOD: Nano Banana 2 (metin→görsel, 2K) ile sahne üret ──────
      if (!post.imagePrompt) throw new Error("Görsel prompt yok.");

      await this.log(postId, `${GEMINI_IMAGE_MODEL} (${IMAGE_SIZE}) ile görsel üretimi başlatıldı...`);

      const feedPath = await this.generateTextToImage(ai, post.imagePrompt, FEED_SIZE, "vertical 3:4 feed", uploadDir);

      let storyPath: string | null = null;
      if (platform === PLATFORM.INSTAGRAM) {
        storyPath = await this.generateTextToImage(ai, post.imagePrompt, STORY_SIZE, "vertical 9:16 story", uploadDir);
      }

      await prisma.post.update({
        where: { id: postId },
        data: {
          imagePath:      `/uploads/${path.basename(feedPath)}`,
          storyImagePath: storyPath ? `/uploads/${path.basename(storyPath)}` : null,
          status:         POST_STATUS.QC_REVIEW,
        },
      });

      await this.log(postId, `Görsel üretildi. Feed: ${path.basename(feedPath)}${storyPath ? ` | Story: ${path.basename(storyPath)}` : ""}`);
      return true;

    } catch (err: any) {
      await this.log(postId, `BAŞARISIZ: ${err.message}`);
      return false;
    }
  }

  // ─── Ürün Referanslı Üretim (Gemini 2.5 Flash Image) ──────────────────────
  // Gerçek paket görselini referans verip sahneye fotorealistik render ettirir.
  // Çıktı sonra hedef orana (sharp cover-fit) tam oturtulur.

  private async generateWithProductReference(
    ai: GoogleGenAI,
    productAbs: string,
    scene: string,
    size: { w: number; h: number },
    orientationHint: string,
    uploadDir: string,
  ): Promise<string> {
    const bytes = await fs.promises.readFile(productAbs);
    const ext   = path.extname(productAbs).toLowerCase();
    const mime  = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/webp";

    const instruction =
      `Use the provided product package as the EXACT hero product — preserve its packaging design, label, colors and text precisely (do not redesign or relabel it). ` +
      `Render a photorealistic, professional commercial lifestyle photograph placing this real product naturally into the following scene: ${scene}. ` +
      `The product must be the clear focal point, well-lit and sharp. ${orientationHint} composition, appetizing and on-brand. No extra text, no watermark, no duplicate products.`;

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
    if (!imgPart) throw new Error("Gemini görsel döndürmedi.");

    // Hedef orana tam oturt (cover-fit), JPEG kaydet
    const fitted = await sharp(Buffer.from(imgPart.inlineData.data, "base64"))
      .resize({ width: size.w, height: size.h, fit: "cover", position: "attention" })
      .jpeg({ quality: 90 })
      .toBuffer();

    const name     = `product-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.jpg`;
    const filePath = path.join(uploadDir, name);
    await fs.promises.writeFile(filePath, fitted);
    return filePath;
  }

  // ─── Nano Banana 2 Metin→Görsel (2K) ──────────────────────────────────────
  // Referans görsel olmadan, prompt'tan doğrudan 2K görsel üretir.

  private async generateTextToImage(
    ai: GoogleGenAI,
    prompt: string,
    size: { w: number; h: number },
    orientationHint: string,
    uploadDir: string,
  ): Promise<string> {
    const res: any = await ai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: [{
        role: "user",
        parts: [{ text: `${prompt}. ${orientationHint} composition, photorealistic, high detail. No text, no watermark.` }],
      }],
      config: { responseModalities: ["IMAGE"], imageConfig: { imageSize: IMAGE_SIZE } },
    });

    const parts   = res.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p: any) => p.inlineData?.data);
    if (!imgPart) throw new Error("Nano Banana 2 görsel döndürmedi.");

    const fitted = await sharp(Buffer.from(imgPart.inlineData.data, "base64"))
      .resize({ width: size.w, height: size.h, fit: "cover", position: "attention" })
      .jpeg({ quality: 90 })
      .toBuffer();

    const name     = `scene-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.jpg`;
    const filePath = path.join(uploadDir, name);
    await fs.promises.writeFile(filePath, fitted);
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
