import prisma from "../db";
import { PDFDocument, rgb, StandardFonts, PDFFont, RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";
import { PLAN_STATUS } from "../constants";
import { generateSummaryPdf, type SummaryReportData } from "../pdf/pdfme-summary";
import { REPORTS_DIR, ensureReportsDir } from "../reports";
import { cleanAgentError } from "../agentError";

const PAGE_W = 595.28;
const MARGIN  = 36;

// ─── Renk yardımcilari ────────────────────────────────────────────────────────

function hexToRgb(hex: string): RGB {
  const c = hex.replace("#", "");
  return rgb(
    parseInt(c.substring(0, 2), 16) / 255,
    parseInt(c.substring(2, 4), 16) / 255,
    parseInt(c.substring(4, 6), 16) / 255,
  );
}

function contrastColor(hex: string): RGB {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.5 ? rgb(0.08, 0.09, 0.22) : rgb(1, 1, 1);
}

function lightTint(hex: string, a = 0.07): RGB {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  return rgb(r * a + (1 - a), g * a + (1 - a), b * a + (1 - a));
}

// Sadece PDF icin sorunlu karakterleri degistir — Turkce karakterlere DOKUNMA
function sanitize(text: string): string {
  if (!text) return "";
  return text
    .replace(/‘|’/g, "'")   // curly single quotes
    .replace(/“|”/g, '"')   // curly double quotes
    .replace(/…/g, "...")        // ellipsis
    .replace(/–/g, "-")          // en dash
    .replace(/—/g, "--")         // em dash
    .replace(/•|‣/g, "*")   // bullets
    .replace(/[\uD800-\uDFFF]/g, ""); // surrogate pairs (emoji)
}

// Metni font genisligi esasinda satirlara bol
function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const result: string[] = [];
  for (const raw of text.split("\n")) {
    const words = raw.split(" ");
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxW && cur) {
        result.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) result.push(cur);
  }
  return result;
}

// Metni kutu genisligine sigdirmak icin font boyutunu otomatik sec
function fitFontSize(text: string, font: PDFFont, boxW: number, maxSize: number, minSize = 7): number {
  let s = maxSize;
  while (s >= minSize && font.widthOfTextAtSize(text, s) > boxW) s -= 0.5;
  return s;
}

// ─── Ajan ─────────────────────────────────────────────────────────────────────

export class ReportGeneratorAgent {
  private agentName = "Report Generator (PDF ve Rapor Uzmani)";

  async execute(planId: number): Promise<boolean> {
    try {
      const plan = await prisma.monthlyPlan.findUnique({
        where: { id: planId },
        include: { brand: true, posts: { orderBy: { scheduledAt: "asc" } } },
      });

      if (!plan || plan.posts.length === 0) {
        await this.log(planId, "HATA: Raporlanacak gonderi bulunamadi.");
        return false;
      }

      await this.log(planId, "PDF musteri sunumu hazirlaniyor...");

      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);

      const { regular, bold } = await this.loadFonts(pdfDoc);
      const brandHex = (plan.brand as any).brandColor ?? "#1a1a2e";
      const logoPath = (plan.brand as any).logoPath ?? null;

      await this.addCoverPage(pdfDoc, plan, regular, bold, brandHex, logoPath);

      for (let i = 0; i < plan.posts.length; i++) {
        await this.addPostPage(pdfDoc, plan, plan.posts[i], i, regular, bold, brandHex, 841.89);
      }

      const pdfBytes  = await pdfDoc.save();
      const fileName  = `${plan.brand.slug}-plan-${plan.month}-${plan.year}.pdf`;
      // Rapor public DIŞINDA özel dizine yazılır — yalnızca yetkili route ile erişilir
      ensureReportsDir();
      await fs.promises.writeFile(path.join(REPORTS_DIR, fileName), pdfBytes);

      const reportPath = fileName; // sadece dosya adı saklanır
      await prisma.monthlyPlan.update({
        where: { id: planId },
        data:  { reportPath, status: PLAN_STATUS.READY },
      });

      await this.log(planId, `PDF hazir (${plan.posts.length} gonderi): ${reportPath}`);
      return true;

    } catch (err: any) {
      console.error("[ReportGenerator] HATA:", err.message, err.stack);
      await this.log(planId, `BASARISIZ: ${err.message}`);
      return false;
    }
  }

  // ─── Hızlı Özet Raporu (pdfme tabanlı) ───────────────────────────────────
  // Tam pdf-lib raporu yerine kullanılabilir — daha hızlı, template tabanlı.

  async executeSummary(planId: number): Promise<boolean> {
    try {
      const plan = await prisma.monthlyPlan.findUnique({
        where: { id: planId },
        include: {
          brand: true,
          posts: {
            orderBy: { scheduledAt: "asc" },
            include: { metrics: true },
          },
        },
      });

      if (!plan) return false;

      const monthNames = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
      const published  = plan.posts.filter((p: any) => p.status === "PUBLISHED");
      const totalLikes = published.reduce((s: number, p: any) => s + (p.metrics?.likes ?? 0), 0);

      const data: SummaryReportData = {
        brandName:     plan.brand.name,
        month:         monthNames[(plan.month ?? 1) - 1] ?? String(plan.month),
        year:          plan.year,
        brandColor:    (plan.brand as any).brandColor ?? "#1a1a2e",
        totalPosts:    plan.posts.length,
        publishedCount: published.length,
        avgLikes:      published.length ? Math.round(totalLikes / published.length) : 0,
        posts: plan.posts.map((p: any) => ({
          platform:    p.platform ?? "",
          topic:       p.topic    ?? "",
          caption:     p.caption  ?? "",
          scheduledAt: p.scheduledAt ? new Date(p.scheduledAt).toISOString().slice(0, 10) : "",
          status:      p.status   ?? "",
          likes:       p.metrics?.likes    ?? undefined,
          comments:    p.metrics?.comments ?? undefined,
          reach:       p.metrics?.reach    ?? undefined,
        })),
      };

      ensureReportsDir();
      const reportPath = await generateSummaryPdf(data, REPORTS_DIR);

      await prisma.monthlyPlan.update({
        where: { id: planId },
        data:  { reportPath },
      });

      await this.log(planId, `Özet PDF hazır (pdfme): ${reportPath}`);
      return true;

    } catch (err: any) {
      await this.log(planId, `Özet PDF BAŞARISIZ: ${cleanAgentError(err)}`);
      return false;
    }
  }

  // ─── Font yukleme ─────────────────────────────────────────────────────────

  private async loadFonts(pdfDoc: PDFDocument): Promise<{ regular: PDFFont; bold: PDFFont }> {
    const regPath  = path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf");
    const boldPath = path.join(process.cwd(), "public", "fonts", "NotoSans-Bold.ttf");
    try {
      const [rB, bB] = await Promise.all([fs.promises.readFile(regPath), fs.promises.readFile(boldPath)]);
      return {
        regular: await pdfDoc.embedFont(rB,  { subset: false }),
        bold:    await pdfDoc.embedFont(bB,  { subset: false }),
      };
    } catch (e: any) {
      console.warn("[ReportGenerator] Font fallback:", e.message);
      return {
        regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
        bold:    await pdfDoc.embedFont(StandardFonts.HelveticaBold),
      };
    }
  }

  // ─── Kapak sayfasi ────────────────────────────────────────────────────────

  private async addCoverPage(
    pdfDoc: PDFDocument, plan: any,
    regular: PDFFont, bold: PDFFont,
    brandHex: string, logoPath: string | null,
  ) {
    const PAGE_H     = 841.89;
    const TOP_H      = Math.round(PAGE_H * 0.55);
    const page       = pdfDoc.addPage([PAGE_W, PAGE_H]);
    const brandRgb   = hexToRgb(brandHex);
    const tintRgb    = lightTint(brandHex, 0.07);
    const darkRgb    = rgb(0.07, 0.07, 0.12);
    const WHITE      = rgb(1, 1, 1);

    // ── Ust renkli blok ───────────────────────────────────────────────────────
    page.drawRectangle({ x: 0, y: PAGE_H - TOP_H, width: PAGE_W, height: TOP_H, color: brandRgb });

    // Sag alt kose dekoratif kesim
    page.drawRectangle({ x: PAGE_W - 130, y: PAGE_H - TOP_H, width: 130, height: 130, color: WHITE });
    page.drawEllipse({ x: PAGE_W - 130, y: PAGE_H - TOP_H + 130, xScale: 130, yScale: 130, color: brandRgb });

    // Sol alt kose dekoratif kucuk cember (aksan)
    page.drawEllipse({ x: 0, y: PAGE_H - TOP_H, xScale: 50, yScale: 50,
      borderColor: WHITE, borderWidth: 1.5, color: undefined as any });

    // ── Logo / Marka adi ───────────────────────────────────────────────────────
    const centerX    = PAGE_W / 2;
    // Logo dikey merkez: ust blogun ortasi biraz yukarisi
    const logoMidY   = PAGE_H - TOP_H / 2 + 40;
    let   belowLogo  = logoMidY - 30;

    let logoEmbedOk = false;
    if (logoPath) {
      try {
        const absPath  = path.join(process.cwd(), "public", logoPath);
        const imgBytes = await fs.promises.readFile(absPath);
        const img      = await pdfDoc.embedPng(imgBytes);
        const logoW    = 220;
        const logoH    = Math.round((img.height / img.width) * logoW);
        page.drawImage(img, {
          x:      centerX - logoW / 2,
          y:      logoMidY - logoH / 2,
          width:  logoW,
          height: logoH,
        });
        belowLogo   = logoMidY - logoH / 2 - 22;
        logoEmbedOk = true;
      } catch (e: any) {
        console.warn("[ReportGenerator] Logo embed hatasi:", e.message);
      }
    }

    if (!logoEmbedOk) {
      // Logosuz: sadece marka adi
      const nameStr  = sanitize(plan.brand.name.toUpperCase());
      const nameSize = 42;
      const nameW    = bold.widthOfTextAtSize(nameStr, nameSize);
      page.drawText(nameStr, {
        x: centerX - nameW / 2, y: logoMidY - 14,
        size: nameSize, font: bold, color: WHITE,
      });
      belowLogo = logoMidY - 62;
    }

    // Ince beyaz cizgi
    page.drawLine({
      start: { x: centerX - 70, y: belowLogo },
      end:   { x: centerX + 70, y: belowLogo },
      thickness: 0.8, color: rgb(1, 1, 1),
    });
    belowLogo -= 14;

    // Alt baslik
    const sub  = "AYLIK SOSYAL MEDYA ICERIK PLANI";
    const subW = regular.widthOfTextAtSize(sub, 9.5);
    page.drawText(sub, {
      x: centerX - subW / 2, y: belowLogo,
      size: 9.5, font: regular, color: WHITE, opacity: 0.80,
    });

    // ── Alt beyaz bolge ───────────────────────────────────────────────────────
    const bodyTop = PAGE_H - TOP_H;

    // Ay / Yil
    const MONTH_NAMES = ["","Ocak","Subat","Mart","Nisan","Mayis","Haziran","Temmuz","Agustos","Eylul","Ekim","Kasim","Aralik"];
    const monthStr = `${MONTH_NAMES[plan.month] ?? plan.month} ${plan.year}`;
    const monthSz  = 34;
    const monthW   = bold.widthOfTextAtSize(sanitize(monthStr), monthSz);
    page.drawText(sanitize(monthStr), {
      x: PAGE_W / 2 - monthW / 2, y: bodyTop - 56,
      size: monthSz, font: bold, color: darkRgb,
    });

    // Aksan cubugu
    page.drawRectangle({ x: PAGE_W / 2 - 28, y: bodyTop - 68, width: 56, height: 3.5, color: brandRgb });

    // 3 istatistik kutusu
    const platforms = [...new Set(plan.posts.map((p: any) => (p.platform ?? "instagram").toUpperCase()))].join(" + ");
    const stats = [
      { label: "GONDERI", value: String(plan.posts.length) },
      { label: "PLATFORM", value: platforms },
      { label: "GORSEL HAZIR", value: `${plan.posts.filter((p: any) => p.imagePath).length} / ${plan.posts.length}` },
    ];

    const gapX = 10;
    const boxW = (PAGE_W - MARGIN * 2 - gapX * 2) / 3;
    const boxH = 68;
    const boxY = bodyTop - 160;

    stats.forEach((s, i) => {
      const bx = MARGIN + i * (boxW + gapX);
      page.drawRectangle({ x: bx, y: boxY, width: boxW, height: boxH, color: tintRgb });
      page.drawRectangle({ x: bx, y: boxY + boxH - 4, width: boxW, height: 4, color: brandRgb });

      // Deger — otomatik font boyutu (sicisirsa kucultur)
      const valInner  = boxW - 28;
      const valStr    = sanitize(s.value);
      const valSize   = fitFontSize(valStr, bold, valInner, 20, 9);
      page.drawText(valStr, { x: bx + 14, y: boxY + 36, size: valSize, font: bold, color: darkRgb });

      // Etiket
      page.drawText(s.label, { x: bx + 14, y: boxY + 16, size: 7.5, font: regular, color: rgb(0.45, 0.45, 0.55) });
    });

    // Musteri notu (varsa)
    if (plan.clientBrief) {
      const briefLines = wrapText(sanitize(plan.clientBrief), regular, 8.5, PAGE_W - MARGIN * 2).slice(0, 2);
      let by = boxY - 30;
      page.drawText("MUSTERI NOTU:", { x: MARGIN, y: by, size: 7, font: bold, color: rgb(0.45, 0.45, 0.55) });
      by -= 13;
      for (const l of briefLines) {
        page.drawText(l, { x: MARGIN, y: by, size: 8.5, font: regular, color: rgb(0.22, 0.22, 0.3) });
        by -= 13;
      }
    }

    // Footer
    page.drawLine({ start: { x: 0, y: 36 }, end: { x: PAGE_W, y: 36 }, thickness: 0.4, color: rgb(0.88, 0.88, 0.88) });
    page.drawText("Hazirlayan: SocialAI Platform", {
      x: MARGIN, y: 16, size: 7.5, font: regular, color: rgb(0.55, 0.55, 0.6),
    });
    const gizliStr = "Gizli — Sadece musteri kullanimicindir.";
    page.drawText(gizliStr, {
      x: PAGE_W - MARGIN - regular.widthOfTextAtSize(gizliStr, 7.5),
      y: 16, size: 7.5, font: regular, color: rgb(0.55, 0.55, 0.6),
    });
  }

  // ─── Gonderi sayfasi — Sunum stili ───────────────────────────────────────
  // Her post: A4 sayfasi, beyaz arka plan, temiz iki sutunlu layout
  //   Sol  : thumbnail + buyuk onizleme gorsel (yan yana)
  //   Sag  : "Aciklama Metni:" baslik + caption + hashtag

  private async addPostPage(
    pdfDoc: PDFDocument, plan: any, post: any, index: number,
    regular: PDFFont, bold: PDFFont, brandHex: string, _fixedPageH: number,
  ) {
    const PAGE_H   = 841.89;   // sabit A4
    const HEADER_H = 56;
    const FOOTER_H = 42;
    const CONTENT_TOP = PAGE_H - HEADER_H - 22;
    const CONTENT_BOT = FOOTER_H + 12;

    const brandRgb = hexToRgb(brandHex);
    const darkRgb  = rgb(0.08, 0.09, 0.22);
    const grayRgb  = rgb(0.42, 0.42, 0.52);
    const page     = pdfDoc.addPage([PAGE_W, PAGE_H]);

    // ── HEADER ───────────────────────────────────────────────────────────────
    // Beyaz zemin; sol: logo/marka, sag: "DD.MM.YYYY ● Post"

    // Logo veya marka adi
    let logoDrwn = false;
    const logoPath: string | null = (plan.brand as any).logoPath ?? null;
    if (logoPath) {
      try {
        const raw   = await fs.promises.readFile(path.join(process.cwd(), "public", logoPath));
        const isJpg = logoPath.toLowerCase().endsWith(".jpg") || logoPath.toLowerCase().endsWith(".jpeg");
        const img   = isJpg ? await pdfDoc.embedJpg(raw) : await pdfDoc.embedPng(raw);
        const lH    = 30;
        const lW    = Math.round((img.width / img.height) * lH);
        page.drawImage(img, { x: MARGIN, y: PAGE_H - MARGIN / 2 - lH, width: lW, height: lH });
        logoDrwn = true;
      } catch { /* fallback */ }
    }
    if (!logoDrwn) {
      page.drawText(sanitize(plan.brand.name), {
        x: MARGIN, y: PAGE_H - 26,
        size: 14, font: bold, color: darkRgb,
      });
    }

    // Tarih + "Post" etiketi (sag)
    let dateStr = "";
    if (post.scheduledAt) {
      const d  = new Date(post.scheduledAt);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      dateStr  = `${dd}.${mm}.${d.getFullYear()}`;
    }
    if (dateStr) {
      const SZ      = 12;
      const postLbl = "Post";
      const dotLbl  = "  ●  ";   // ●
      const dateW   = bold.widthOfTextAtSize(sanitize(dateStr), SZ);
      const dotW    = bold.widthOfTextAtSize(dotLbl, SZ);
      const postW   = regular.widthOfTextAtSize(postLbl, SZ);
      const rightEnd = PAGE_W - MARGIN;

      page.drawText(postLbl, {
        x: rightEnd - postW, y: PAGE_H - 26,
        size: SZ, font: regular, color: grayRgb,
      });
      page.drawText(dotLbl, {
        x: rightEnd - postW - dotW, y: PAGE_H - 26,
        size: SZ, font: bold, color: brandRgb,
      });
      page.drawText(sanitize(dateStr), {
        x: rightEnd - postW - dotW - dateW, y: PAGE_H - 26,
        size: SZ, font: bold, color: darkRgb,
      });
    }

    // Baslik alt cizgisi (marka rengi, ince)
    page.drawLine({
      start: { x: 0,     y: PAGE_H - HEADER_H },
      end:   { x: PAGE_W, y: PAGE_H - HEADER_H },
      thickness: 2, color: brandRgb,
    });

    // ── GORSEL BÖLGE (sol, iki gorsel yan yana) ──────────────────────────────
    //  Sol  : kucuk kare thumbnail   (118 × 118)
    //  Orta : buyuk portrait onizleme (140 × 187)  [3:4 oran]

    const THUMB_W    = 120;
    const THUMB_H    = 120;
    const IMG_GAP    = 12;
    const MAIN_W     = 145;
    const MAIN_H     = Math.round(MAIN_W * 4 / 3);   // 193
    const IMG_ZONE_W = THUMB_W + IMG_GAP + MAIN_W;    // 277

    const thumbX = MARGIN;
    const thumbY = CONTENT_TOP - THUMB_H;
    const mainX  = MARGIN + THUMB_W + IMG_GAP;
    const mainY  = CONTENT_TOP - MAIN_H;

    const plhColor = rgb(0.91, 0.91, 0.91);
    const plhTxt   = rgb(0.62, 0.62, 0.62);

    const embedImg = async (imgPath: string) => {
      const raw   = await fs.promises.readFile(path.join(process.cwd(), "public", imgPath));
      const lower = imgPath.toLowerCase();
      return lower.endsWith(".png") ? pdfDoc.embedPng(raw) : pdfDoc.embedJpg(raw);
    };

    if (post.imagePath) {
      try {
        const img = await embedImg(post.imagePath);
        page.drawImage(img, { x: thumbX, y: thumbY, width: THUMB_W, height: THUMB_H });
        page.drawImage(img, { x: mainX,  y: mainY,  width: MAIN_W,  height: MAIN_H  });
      } catch {
        page.drawRectangle({ x: thumbX, y: thumbY, width: THUMB_W, height: THUMB_H, color: plhColor });
        page.drawRectangle({ x: mainX,  y: mainY,  width: MAIN_W,  height: MAIN_H,  color: plhColor });
        page.drawText("Gorsel", { x: mainX + 30, y: mainY + MAIN_H / 2, size: 8, font: regular, color: plhTxt });
      }
    } else {
      page.drawRectangle({ x: thumbX, y: thumbY, width: THUMB_W, height: THUMB_H, color: plhColor });
      page.drawRectangle({ x: mainX,  y: mainY,  width: MAIN_W,  height: MAIN_H,  color: plhColor });
      page.drawText("Gorsel Bekleniyor", { x: mainX + 14, y: mainY + MAIN_H / 2, size: 7, font: regular, color: plhTxt });
    }

    // Gorsel format etiketi (sol alt kose)
    page.drawRectangle({ x: thumbX, y: thumbY, width: THUMB_W, height: 15, color: rgb(0,0,0), opacity: 0.45 });
    page.drawText("Feed", { x: thumbX + 5, y: thumbY + 4, size: 7, font: bold, color: rgb(1,1,1) });

    // Story gorseli (varsa, main gorselinin altinda kucuk)
    if (post.storyImagePath) {
      try {
        const img    = await embedImg(post.storyImagePath);
        const stH    = 90;
        const stW    = Math.round(stH * 9 / 16);
        const storyX = thumbX;
        const storyY = thumbY - stH - 10;
        if (storyY >= CONTENT_BOT) {
          page.drawImage(img, { x: storyX, y: storyY, width: stW, height: stH });
          page.drawRectangle({ x: storyX, y: storyY, width: stW, height: 14, color: rgb(0,0,0), opacity: 0.45 });
          page.drawText("Story 9:16", { x: storyX + 4, y: storyY + 4, size: 6.5, font: bold, color: rgb(1,1,1) });
        }
      } catch { /* atla */ }
    }

    // ── METIN BÖLGE (sag) ─────────────────────────────────────────────────────
    const TEXT_GAP = 22;
    const TEXT_X   = MARGIN + IMG_ZONE_W + TEXT_GAP;
    const TEXT_W   = PAGE_W - MARGIN - TEXT_X;   // ~234px

    let ty = CONTENT_TOP;

    // "Aciklama Metni:" baslik
    page.drawText("Aciklama Metni:", {
      x: TEXT_X, y: ty,
      size: 12, font: bold, color: darkRgb,
    });
    ty -= 22;

    // Caption metni
    const capLines = post.caption
      ? wrapText(sanitize(post.caption), regular, 9.5, TEXT_W)
      : [];

    for (const line of capLines) {
      if (ty < CONTENT_BOT + 50) break;
      page.drawText(line, { x: TEXT_X, y: ty, size: 9.5, font: regular, color: rgb(0.13, 0.13, 0.13) });
      ty -= 14;
    }

    ty -= 16;

    // Hashtag'ler (marka rengiyle, ince ayirici sonrasi)
    if (post.hashtags && ty > CONTENT_BOT + 16) {
      page.drawLine({
        start: { x: TEXT_X, y: ty + 8 }, end: { x: TEXT_X + TEXT_W, y: ty + 8 },
        thickness: 0.4, color: rgb(0.85, 0.85, 0.85),
      });
      ty -= 6;

      const hashLines = wrapText(sanitize(post.hashtags), regular, 8.5, TEXT_W);
      for (const line of hashLines) {
        if (ty < CONTENT_BOT) break;
        page.drawText(line, { x: TEXT_X, y: ty, size: 8.5, font: regular, color: brandRgb });
        ty -= 12;
      }
    }

    // ── FOOTER ────────────────────────────────────────────────────────────────
    page.drawLine({
      start: { x: 0, y: FOOTER_H + 8 }, end: { x: PAGE_W, y: FOOTER_H + 8 },
      thickness: 0.4, color: rgb(0.87, 0.87, 0.87),
    });

    // Sol: platform adi
    const platStr = (post.platform ?? "instagram").charAt(0).toUpperCase() +
                    (post.platform ?? "instagram").slice(1);
    page.drawText(sanitize(`${plan.brand.name}  |  ${platStr}`), {
      x: MARGIN, y: 18, size: 8, font: regular, color: grayRgb,
    });

    // Sag: sayfa numarasi
    const pgStr = `${index + 1} / ${plan.posts.length}`;
    page.drawText(pgStr, {
      x: PAGE_W - MARGIN - regular.widthOfTextAtSize(pgStr, 8),
      y: 18, size: 8, font: regular, color: grayRgb,
    });
  }

  private async log(planId: number, action: string): Promise<void> {
    await prisma.agentLog.create({
      data: { agentName: this.agentName, action, targetType: "Plan", targetId: planId },
    });
  }
}
