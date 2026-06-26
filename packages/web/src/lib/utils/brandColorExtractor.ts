import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";
import { Jimp } from "jimp";

// ─── Logo URL bul ─────────────────────────────────────────────────────────────

export async function fetchBrandLogoUrl(websiteUrl: string): Promise<string | null> {
  try {
    const res = await fetch(websiteUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SocialAI/1.0)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $    = cheerio.load(html);

    // Öncelik sırası: og:image → apple-touch-icon → logo img → favicon
    const candidates: string[] = [];

    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage) candidates.push(ogImage);

    const appleIcon = $('link[rel="apple-touch-icon"]').attr("href");
    if (appleIcon) candidates.push(appleIcon);

    // "logo" içeren img src'leri
    $("img").each((_, el) => {
      const src = $(el).attr("src") ?? "";
      const alt = $(el).attr("alt") ?? "";
      const cls = $(el).attr("class") ?? "";
      if (/logo/i.test(src + alt + cls)) candidates.push(src);
    });

    const favicon = $('link[rel="icon"], link[rel="shortcut icon"]').first().attr("href");
    if (favicon) candidates.push(favicon);

    if (candidates.length === 0) return null;

    // İlk adayı mutlak URL'ye çevir
    const base = new URL(websiteUrl);
    for (const c of candidates) {
      if (!c) continue;
      try {
        return new URL(c, base).href;
      } catch { continue; }
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Logo indir → dosyaya kaydet ──────────────────────────────────────────────

export async function downloadLogo(logoUrl: string, saveDir: string, slug: string): Promise<string | null> {
  try {
    const res = await fetch(logoUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;

    const buf       = Buffer.from(await res.arrayBuffer());
    const ext       = logoUrl.split("?")[0].split(".").pop()?.toLowerCase() ?? "png";
    const safeExt   = ["png", "jpg", "jpeg", "webp", "svg", "ico"].includes(ext) ? ext : "png";
    const fileName  = `${slug}-logo.${safeExt}`;
    const filePath  = path.join(saveDir, fileName);

    await fs.promises.mkdir(saveDir, { recursive: true });
    await fs.promises.writeFile(filePath, buf);
    return filePath;
  } catch {
    return null;
  }
}

// ─── SVG'den renk çıkar ───────────────────────────────────────────────────────

export async function extractColorFromSvg(svgPath: string): Promise<string | null> {
  try {
    const content = await fs.promises.readFile(svgPath, "utf-8");
    // fill="#XXXXXX" veya fill='#XXXXXX' ara — beyaz ve siyah hariç
    const matches = [...content.matchAll(/fill=["']#([0-9a-fA-F]{3,6})["']/g)];
    for (const m of matches) {
      const hex = `#${m[1]}`;
      const clean = hex.replace("#", "");
      const r = parseInt(clean.substring(0, 2), 16);
      const g = parseInt(clean.substring(2, 4), 16);
      const b = parseInt(clean.substring(4, 6), 16);
      // Beyaz (>230 tüm kanallar) ve siyah (<30) atla
      if (r > 230 && g > 230 && b > 230) continue;
      if (r < 30  && g < 30  && b < 30)  continue;
      return hex.length === 4 // kısa hex → genişlet
        ? `#${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}`
        : hex;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Dominant renk çıkar (jimp ile) ──────────────────────────────────────────

export async function extractDominantColor(imagePath: string): Promise<string> {
  // SVG ise XML parse et
  if (imagePath.toLowerCase().endsWith(".svg")) {
    const svgColor = await extractColorFromSvg(imagePath);
    if (svgColor) return svgColor;
    return "#1a1a2e";
  }

  try {
    const img = await Jimp.read(imagePath);

    // PNG/ICO'yu RGB bitmap olarak işle, 64×64'e küçült (hız)
    img.resize({ w: 64, h: 64 });

    const colorMap: Record<string, number> = {};

    const { width, height, data } = img.bitmap;
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        const idx = (width * py + px) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        // Şeffaf, beyaz (>240) ve çok koyu (<15) pikselleri atla
        if (a < 50) continue;
        if (r > 240 && g > 240 && b > 240) continue;
        if (r < 15  && g < 15  && b < 15)  continue;

        // Rengi 32 adımlı bucketlara grupla
        const rB = Math.round(r / 32) * 32;
        const gB = Math.round(g / 32) * 32;
        const bB = Math.round(b / 32) * 32;
        const key = `${rB},${gB},${bB}`;
        colorMap[key] = (colorMap[key] ?? 0) + 1;
      }
    }

    const sorted = Object.entries(colorMap).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return "#1a1a2e";

    const [rS, gS, bS] = sorted[0][0].split(",").map(Number);
    return `#${rS.toString(16).padStart(2, "0")}${gS.toString(16).padStart(2, "0")}${bS.toString(16).padStart(2, "0")}`;
  } catch {
    return "#1a1a2e";
  }
}
