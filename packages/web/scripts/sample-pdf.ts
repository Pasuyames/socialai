/**
 * Örnek PDF üretici — gerçek DB olmadan çalışır.
 * Çalıştır: npx tsx scripts/sample-pdf.ts
 * Çıktı   : public/reports/sample-sunum.pdf
 */
import { PDFDocument, rgb, StandardFonts, PDFFont, RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT   = path.join(__dirname, "..");

// ─── Sayfa boyutları (tüm sayfalar aynı) ─────────────────────────────────────
const PAGE_W = 595.28;
const PAGE_H = 580;      // A4 yerine içeriğe göre optimum yükseklik
const MARGIN = 36;

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

function hexToRgb(hex: string): RGB {
  const c = hex.replace("#", "");
  return rgb(
    parseInt(c.substring(0, 2), 16) / 255,
    parseInt(c.substring(2, 4), 16) / 255,
    parseInt(c.substring(4, 6), 16) / 255,
  );
}
function lightTint(hex: string, a = 0.07): RGB {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  return rgb(r * a + (1 - a), g * a + (1 - a), b * a + (1 - a));
}
function contrastColor(hex: string): RGB {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.5 ? rgb(0.08, 0.09, 0.22) : rgb(1, 1, 1);
}
function sanitize(text: string): string {
  if (!text) return "";
  return text
    .replace(/['']/g, "'").replace(/[""]/g, '"')
    .replace(/…/g, "...").replace(/–/g, "-").replace(/—/g, "--")
    .replace(/[•‣]/g, "*").replace(/[\uD800-\uDFFF]/g, "");
}
function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const result: string[] = [];
  for (const raw of text.split("\n")) {
    const words = raw.split(" ");
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxW && cur) { result.push(cur); cur = w; }
      else cur = test;
    }
    if (cur) result.push(cur);
  }
  return result;
}
function fitFontSize(text: string, font: PDFFont, boxW: number, maxSize: number, minSize = 7): number {
  let s = maxSize;
  while (s >= minSize && font.widthOfTextAtSize(text, s) > boxW) s -= 0.5;
  return s;
}

// ─── Mock Veri ────────────────────────────────────────────────────────────────

const BRAND = {
  name:       "Demo Marka",
  brandColor: "#2D6A4F",
  logoPath:   null as string | null,
};

const POSTS = [
  {
    topic:       "Mevsim Meyve ve Sebzeleri — Haziran",
    platform:    "instagram",
    scheduledAt: new Date("2026-06-03T10:00:00"),
    caption:     "Baharin en taze ve renkli lezzetleri tezgahlardaki yerini aldi!\n\nVucudumuzun ihtiyac duydugu vitamin ve mineralleri en dogru zamanda almak icin mevsiminde beslenmek altin kuralidir. Iste Haziran ayinda mutfaginizdan eksik etmemeniz gereken taptaze meyve ve sebzeler.\n\nSizin bu aydaki favorizin hangisi? Yorumlarda bulusalalim!",
    hashtags:    "#DemoMarka #MevsimindeBeslenme #HaziranAyi #TazeMeyveSebze #SaglikliGida #BaharLezzetleri #DogalBeslenme #TemizGida",
    hook:        "Baharin en taze ve renkli lezzetleri tezgahlarda!",
    imagePath:   null, storyImagePath: null,
  },
  {
    topic:       "Dogadan Sofraya — Marka Degerlerimiz",
    platform:    "instagram",
    scheduledAt: new Date("2026-06-06T14:00:00"),
    caption:     "Soframuza gelen her iyilik, topragin bize sundugu bir armağandir.\n\nDemo Marka olarak, dogranin bu essiz dengesini koruyarak en saf, en dogal ve en katkisiz olani sizlerle bulusturmak icin calisiyoruz. Safligi, seffafligi ve dogalligi her urunumuzde yasatiyoruz.\n\nKaynagindan mutfaginiza, dogallik hep sizinle olsun.",
    hashtags:    "#DemoMarka #DogadanSofraya #DogalYasam #TemizGida #SurdurulebilirTarim #SaglikliYasam #DoganinKalbinden #SafGida",
    hook:        "Her kasikte dogayi hissedebilmek mumkun.",
    imagePath:   null, storyImagePath: null,
  },
  {
    topic:       "Yeni Urun: Chia Tohumu",
    platform:    "instagram",
    scheduledAt: new Date("2026-06-12T11:00:00"),
    caption:     "Kucucuk tohumlarda sakli devasa bir besin kaynagi!\n\nDemo Marka Chia Tohumu ile gune enerjik ve hafif bir baslangic yapin. Ister taptaze meyvelerle hazirladiginiz yogurt kasenize serpin, ister o meshur chia pudingini yapin...\n\nSindirim dostu yapisi, uzun sure tok tutma ozelligi ve zengin bitkisel protein icerigiyle tariflerinize deger katiyor. Ustelik tamamen dogal, glutensiz ve vegan!\n\nPeki sizin en sevdiginiz chia tarefiniz hangisi? Yorumlarda bizimle paylasin!",
    hashtags:    "#DemoMarka #ChiaTohumu #SaglikliKahvalti #VeganProtein #GlutensizBeslenme #SindirimDostu #TokTutanBesinler #TemizIcerik #SaglikliYasam #FonksiyonelBeslenme",
    hook:        "Her kasikte saglik sunan chia tohumunun sirlarini ogrenmek ister misiniz?",
    imagePath:   null, storyImagePath: null,
  },
];

// ─── Kapak Sayfası (aynı 595×580 boyutunda) ──────────────────────────────────

async function addCoverPage(pdfDoc: PDFDocument, regular: PDFFont, bold: PDFFont) {
  const page      = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const TOP_H     = Math.round(PAGE_H * 0.52);   // üst renkli blok
  const brandRgb  = hexToRgb(BRAND.brandColor);
  const tintRgb   = lightTint(BRAND.brandColor, 0.07);
  const darkRgb   = rgb(0.07, 0.07, 0.12);
  const WHITE     = rgb(1, 1, 1);
  const centerX   = PAGE_W / 2;

  // Üst renkli alan
  page.drawRectangle({ x: 0, y: PAGE_H - TOP_H, width: PAGE_W, height: TOP_H, color: brandRgb });

  // Dekoratif köşe
  page.drawRectangle({ x: PAGE_W - 100, y: PAGE_H - TOP_H, width: 100, height: 100, color: WHITE });
  page.drawEllipse({ x: PAGE_W - 100, y: PAGE_H - TOP_H + 100, xScale: 100, yScale: 100, color: brandRgb });
  page.drawEllipse({ x: 0, y: PAGE_H - TOP_H, xScale: 40, yScale: 40,
    borderColor: WHITE, borderWidth: 1.2, color: undefined as any });

  // Marka adı
  const logoMidY = PAGE_H - TOP_H / 2 + 20;
  const nameStr  = sanitize(BRAND.name.toUpperCase());
  const nameSize = 32;
  const nameW    = bold.widthOfTextAtSize(nameStr, nameSize);
  page.drawText(nameStr, { x: centerX - nameW / 2, y: logoMidY - 14, size: nameSize, font: bold, color: WHITE });

  // İnce çizgi + alt başlık
  const lineY = logoMidY - 50;
  page.drawLine({ start: { x: centerX - 60, y: lineY }, end: { x: centerX + 60, y: lineY }, thickness: 0.7, color: WHITE });
  const sub  = "AYLIK SOSYAL MEDYA ICERIK PLANI";
  const subW = regular.widthOfTextAtSize(sub, 8.5);
  page.drawText(sub, { x: centerX - subW / 2, y: lineY - 14, size: 8.5, font: regular, color: WHITE, opacity: 0.8 });

  // Alt beyaz bölge
  const bodyTop = PAGE_H - TOP_H;
  const MONTHS  = ["","Ocak","Subat","Mart","Nisan","Mayis","Haziran","Temmuz","Agustos","Eylul","Ekim","Kasim","Aralik"];
  const monthStr = `Haziran 2026`;
  const monthSz  = 28;
  const monthW   = bold.widthOfTextAtSize(monthStr, monthSz);
  page.drawText(monthStr, { x: centerX - monthW / 2, y: bodyTop - 42, size: monthSz, font: bold, color: darkRgb });
  page.drawRectangle({ x: centerX - 24, y: bodyTop - 52, width: 48, height: 3, color: brandRgb });

  // 3 istatistik kutusu
  const stats = [
    { label: "GONDERI",    value: String(POSTS.length) },
    { label: "PLATFORM",   value: "INSTAGRAM" },
    { label: "HAZIR",      value: `0 / ${POSTS.length}` },
  ];
  const gapX = 10;
  const boxW = (PAGE_W - MARGIN * 2 - gapX * 2) / 3;
  const boxH = 55;
  const boxY = bodyTop - 120;

  stats.forEach((s, i) => {
    const bx = MARGIN + i * (boxW + gapX);
    page.drawRectangle({ x: bx, y: boxY, width: boxW, height: boxH, color: tintRgb });
    page.drawRectangle({ x: bx, y: boxY + boxH - 4, width: boxW, height: 4, color: brandRgb });
    const valSize = fitFontSize(s.value, bold, boxW - 24, 18, 8);
    page.drawText(s.value, { x: bx + 12, y: boxY + 30, size: valSize, font: bold, color: darkRgb });
    page.drawText(s.label, { x: bx + 12, y: boxY + 13, size: 7, font: regular, color: rgb(0.45, 0.45, 0.55) });
  });

  // Footer
  page.drawLine({ start: { x: 0, y: 32 }, end: { x: PAGE_W, y: 32 }, thickness: 0.4, color: rgb(0.88, 0.88, 0.88) });
  page.drawText("Hazirlayan: SocialAI Platform", { x: MARGIN, y: 14, size: 7, font: regular, color: rgb(0.55, 0.55, 0.6) });
  const gizli = "Gizli — Sadece musteri kullanimicindir.";
  page.drawText(gizli, { x: PAGE_W - MARGIN - regular.widthOfTextAtSize(gizli, 7), y: 14, size: 7, font: regular, color: rgb(0.55, 0.55, 0.6) });
}

// ─── Post Sayfası ─────────────────────────────────────────────────────────────

async function addPostPage(
  pdfDoc: PDFDocument,
  post: (typeof POSTS)[0],
  index: number,
  regular: PDFFont,
  bold: PDFFont,
) {
  // Layout sabitleri
  const HEADER_H   = 50;
  const FOOTER_H   = 36;
  const PAD_TOP    = 14;
  const PAD_BOT    = 10;
  const CONTENT_TOP = PAGE_H - HEADER_H - PAD_TOP;     // içerik başlangıç y
  const CONTENT_BOT = FOOTER_H + PAD_BOT;              // içerik bitiş y
  const CONTENT_H   = CONTENT_TOP - CONTENT_BOT;       // toplam içerik yüksekliği ~480px

  // Görsel boyutları — tam sol panel yüksekliğini dolduracak şekilde ölçülen
  const IMG_W = 220;
  const IMG_H = Math.round(IMG_W * 4 / 3);             // 3:4 oran = 293px

  // Metin paneli
  const TEXT_X = MARGIN + IMG_W + 20;
  const TEXT_W = PAGE_W - MARGIN - TEXT_X;             // ~283px

  const brandRgb = hexToRgb(BRAND.brandColor);
  const darkRgb  = rgb(0.08, 0.09, 0.22);
  const grayRgb  = rgb(0.42, 0.42, 0.52);
  const page     = pdfDoc.addPage([PAGE_W, PAGE_H]);

  // ── HEADER ─────────────────────────────────────────────────────────────────

  // Marka adı (sol)
  page.drawText(sanitize(BRAND.name), {
    x: MARGIN, y: PAGE_H - 28, size: 14, font: bold, color: darkRgb,
  });

  // Tarih + "● Post" (sağ)
  const d   = post.scheduledAt;
  const dd  = String(d.getDate()).padStart(2, "0");
  const mm  = String(d.getMonth() + 1).padStart(2, "0");
  const dateStr = `${dd}.${mm}.${d.getFullYear()}`;
  const SZ      = 11;
  const dot     = "  ●  ";
  const lbl     = "Post";
  const dateW   = bold.widthOfTextAtSize(dateStr, SZ);
  const dotW    = bold.widthOfTextAtSize(dot, SZ);
  const lblW    = regular.widthOfTextAtSize(lbl, SZ);
  const rEnd    = PAGE_W - MARGIN;

  page.drawText(lbl,     { x: rEnd - lblW,                    y: PAGE_H - 28, size: SZ, font: regular, color: grayRgb });
  page.drawText(dot,     { x: rEnd - lblW - dotW,             y: PAGE_H - 28, size: SZ, font: bold,    color: brandRgb });
  page.drawText(sanitize(dateStr), { x: rEnd - lblW - dotW - dateW, y: PAGE_H - 28, size: SZ, font: bold, color: darkRgb });

  // Başlık alt çizgisi
  page.drawLine({
    start: { x: 0, y: PAGE_H - HEADER_H },
    end:   { x: PAGE_W, y: PAGE_H - HEADER_H },
    thickness: 2.2, color: brandRgb,
  });

  // ── SOL PANEL — GÖRSEL ─────────────────────────────────────────────────────

  const imgX = MARGIN;
  const imgY = CONTENT_TOP - IMG_H;

  // Görsel placeholder (gerçek sistemde post.imagePath'ten yüklenir)
  const plhBg  = lightTint(BRAND.brandColor, 0.18);
  const plhGr  = rgb(0.88, 0.88, 0.88);
  const plhTxt = rgb(0.62, 0.62, 0.62);

  page.drawRectangle({ x: imgX, y: imgY, width: IMG_W, height: IMG_H, color: plhBg });

  // Ortada fotoğraf ikonu simülasyonu
  const icoX = imgX + IMG_W / 2;
  const icoY = imgY + IMG_H / 2 + 10;
  page.drawRectangle({ x: icoX - 18, y: icoY - 13, width: 36, height: 26,
    borderColor: plhTxt, borderWidth: 1, color: undefined as any });
  page.drawEllipse({ x: icoX, y: icoY + 4, xScale: 7, yScale: 7,
    borderColor: plhTxt, borderWidth: 1, color: undefined as any });
  page.drawEllipse({ x: icoX - 11, y: icoY - 7, xScale: 3, yScale: 3, color: plhTxt });
  const lGrStr = "AI Gorsel";
  const lGrW   = regular.widthOfTextAtSize(lGrStr, 8);
  page.drawText(lGrStr, { x: icoX - lGrW / 2, y: imgY + IMG_H / 2 - 10, size: 8, font: regular, color: plhTxt });

  // "Feed" etiketi (sol alt köşe)
  page.drawRectangle({ x: imgX, y: imgY, width: IMG_W, height: 18, color: rgb(0,0,0), opacity: 0.38 });
  page.drawText("Feed  3:4", { x: imgX + 6, y: imgY + 5, size: 7, font: bold, color: rgb(1,1,1) });

  // Görsel altı bilgiler (kalan sol panel alanını doldurur)
  let ly = imgY - 14;

  // Platform badge
  const platStr  = (post.platform ?? "instagram").toUpperCase();
  const platCol  = platStr === "LINKEDIN" ? rgb(0.0, 0.47, 0.71) : brandRgb;
  const platW    = bold.widthOfTextAtSize(platStr, 8) + 16;
  page.drawRectangle({ x: imgX, y: ly - 18, width: platW, height: 18, color: platCol });
  page.drawText(platStr, { x: imgX + 8, y: ly - 13, size: 8, font: bold, color: rgb(1,1,1) });
  ly -= 28;

  // Tarih kutusu
  if (ly > CONTENT_BOT + 50) {
    const tintBox = lightTint(BRAND.brandColor, 0.1);
    page.drawRectangle({ x: imgX, y: ly - 32, width: IMG_W, height: 32, color: tintBox });
    page.drawRectangle({ x: imgX, y: ly - 2,  width: IMG_W, height: 2,  color: brandRgb });
    page.drawText("PAYLASIM TARIHI", { x: imgX + 8, y: ly - 11, size: 6.5, font: bold, color: grayRgb });
    page.drawText(sanitize(dateStr), { x: imgX + 8, y: ly - 22, size: 10, font: bold, color: darkRgb });
    ly -= 44;
  }

  // Konu
  if (ly > CONTENT_BOT + 30 && post.hook) {
    page.drawText("HOOK", { x: imgX, y: ly, size: 6.5, font: bold, color: grayRgb });
    ly -= 13;
    const hookLines = wrapText(sanitize(post.hook), regular, 8.5, IMG_W).slice(0, 3);
    for (const line of hookLines) {
      if (ly < CONTENT_BOT) break;
      page.drawText(line, { x: imgX, y: ly, size: 8.5, font: regular, color: darkRgb });
      ly -= 12;
    }
  }

  // ── SAĞ PANEL — METİN ──────────────────────────────────────────────────────

  let ty = CONTENT_TOP;

  // "Aciklama Metni:" başlık
  page.drawText("Aciklama Metni:", {
    x: TEXT_X, y: ty, size: 12, font: bold, color: darkRgb,
  });
  ty -= 22;

  // Caption satırları
  const capLines = wrapText(sanitize(post.caption), regular, 9.5, TEXT_W);
  for (const line of capLines) {
    if (ty < CONTENT_BOT + 52) break;
    page.drawText(line, { x: TEXT_X, y: ty, size: 9.5, font: regular, color: rgb(0.13, 0.13, 0.13) });
    ty -= 14;
  }

  ty -= 16;

  // Hashtag'ler
  if (post.hashtags && ty > CONTENT_BOT + 14) {
    page.drawLine({
      start: { x: TEXT_X, y: ty + 8 }, end: { x: TEXT_X + TEXT_W, y: ty + 8 },
      thickness: 0.4, color: rgb(0.84, 0.84, 0.84),
    });
    ty -= 8;
    const hashLines = wrapText(sanitize(post.hashtags), regular, 8.5, TEXT_W);
    for (const line of hashLines) {
      if (ty < CONTENT_BOT) break;
      page.drawText(line, { x: TEXT_X, y: ty, size: 8.5, font: regular, color: brandRgb });
      ty -= 12;
    }
  }

  // ── FOOTER ─────────────────────────────────────────────────────────────────

  page.drawLine({
    start: { x: 0, y: FOOTER_H + 6 }, end: { x: PAGE_W, y: FOOTER_H + 6 },
    thickness: 0.4, color: rgb(0.87, 0.87, 0.87),
  });

  page.drawText(sanitize(`${BRAND.name}  |  ${platStr.charAt(0) + platStr.slice(1).toLowerCase()}`), {
    x: MARGIN, y: 16, size: 7.5, font: regular, color: grayRgb,
  });

  const pgStr = `${index + 1} / ${POSTS.length}`;
  page.drawText(pgStr, {
    x: PAGE_W - MARGIN - regular.widthOfTextAtSize(pgStr, 7.5),
    y: 16, size: 7.5, font: regular, color: grayRgb,
  });
}

// ─── Ana Fonksiyon ────────────────────────────────────────────────────────────

async function main() {
  console.log("PDF olusturuluyor...");
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  let regular: PDFFont;
  let bold: PDFFont;
  try {
    const regPath  = path.join(ROOT, "public", "fonts", "NotoSans-Regular.ttf");
    const boldPath = path.join(ROOT, "public", "fonts", "NotoSans-Bold.ttf");
    const [rB, bB] = await Promise.all([fs.promises.readFile(regPath), fs.promises.readFile(boldPath)]);
    regular = await pdfDoc.embedFont(rB,  { subset: false });
    bold    = await pdfDoc.embedFont(bB,  { subset: false });
    console.log("  NotoSans yuklendi.");
  } catch {
    regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    bold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    console.log("  Helvetica fallback.");
  }

  await addCoverPage(pdfDoc, regular, bold);
  console.log("  Kapak eklendi.");

  for (let i = 0; i < POSTS.length; i++) {
    await addPostPage(pdfDoc, POSTS[i], i, regular, bold);
    console.log(`  Post ${i + 1} / ${POSTS.length} eklendi.`);
  }

  const outDir  = path.join(ROOT, "public", "reports");
  await fs.promises.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "sample-sunum-v2.pdf");
  await fs.promises.writeFile(outPath, await pdfDoc.save());
  console.log(`\nPDF hazir: ${outPath}`);
}

main().catch(console.error);
