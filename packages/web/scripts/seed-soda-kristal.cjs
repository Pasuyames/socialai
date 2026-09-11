// Tek seferlik: Soda Kristal Eylul 2026 planini olusturur, gorselleri public/uploads'a
// kopyalar ve ReportGeneratorAgent ile ayni pdf-lib mantigiyla musteri PDF'ini uretir.
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");
const sharp = require("sharp");

const WEB_DIR = path.resolve(__dirname, "..");
const SRC_DIR = "C:\\Users\\musta\\Downloads\\fınal\\fınal";
const UPLOADS_DIR = path.join(WEB_DIR, "public", "uploads");
const { REPORTS_DIR, ensureReportsDir } = require(path.join(WEB_DIR, ".report-paths.cjs"));

const prisma = new PrismaClient();

const PAGE_W = 595.28;
const MARGIN = 36;

function hexToRgb(hex) {
  const c = hex.replace("#", "");
  return rgb(parseInt(c.substring(0, 2), 16) / 255, parseInt(c.substring(2, 4), 16) / 255, parseInt(c.substring(4, 6), 16) / 255);
}
function lightTint(hex, a = 0.07) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) / 255, g = parseInt(c.substring(2, 4), 16) / 255, b = parseInt(c.substring(4, 6), 16) / 255;
  return rgb(r * a + (1 - a), g * a + (1 - a), b * a + (1 - a));
}
function sanitize(text) {
  if (!text) return "";
  return text
    .replace(/‘|’/g, "'")
    .replace(/“|”/g, '"')
    .replace(/…/g, "...")
    .replace(/–/g, "-")
    .replace(/—/g, "--")
    .replace(/•|‣/g, "*")
    .replace(/[\uD800-\uDFFF]/g, "");
}
function wrapText(text, font, size, maxW) {
  const result = [];
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
function fitFontSize(text, font, boxW, maxSize, minSize = 7) {
  let s = maxSize;
  while (s >= minSize && font.widthOfTextAtSize(text, s) > boxW) s -= 0.5;
  return s;
}

// ─── icerik verisi ──────────────────────────────────────────────────────────

const POSTS = [
  { day: 1, topic: "Kristal Bentonit Ovma Kremi", post: "post-01", story: "story-01",
    caption: "Mutfakta gun sonu telasi bitti, sira parlaklikta. Kristal bentonit, minerallerin gucuyle yag ve lekeyi cekip aliyor - tezgahi cizmeden, boyamadan. Dogaya zarar vermez, mineral bazli.",
    hashtags: "#sodakristal #kristalbentonit #ovmakremi #mineraltemizlik #mutfaktemizligi #dogaltemizlik #bitkiselbazli #lekecikarma #evtemizligi" },
  { day: 3, topic: "Sirke Bazli Kirec Sokucu (Sirke-Limon)", post: "post-02", story: "story-02",
    caption: "Kirec lekesi gorunce cekinmeyin - sirkenin dogal gucu, limon ferahligiyla bulustu. Bitkisel bazli formulu kirecle savasirken banyonuza zarar vermez, sadece ferah bir koku birakir.",
    hashtags: "#sodakristal #kirecsokucu #sirkelitemizlik #banyotemizligi #dogalkirecsokucu #bitkiselbazli #dogaltemizlik #evtemizligi" },
  { day: 5, topic: "Anadolu Kastil Camasir Sabunu (Lavanta)", post: "post-03", story: "story-03",
    caption: "Anadolu'nun geleneksel kastil sabun tarifi, bugunun camasir makinesinde. Lavanta esansiyla camasirlariniz temiz olmanin otesinde huzur veren bir kokuyla sariliyor.",
    hashtags: "#sodakristal #camasirsabunu #kastilsabun #anadolusabunu #lavanta #dogalcamasir #bitkiselbazli #dogaltemizlik #evtemizligi" },
  { day: 7, topic: "Anadolu Kastil Bulasik Sabunu (Narenciye)", post: "post-04", story: "story-04",
    caption: "Yagli taklar, narenciyenin dogal gucune teslim oluyor. Kastil sabun teknigiyle uretilen bulasik sabunumuz elinizi yormadan yagi sokuyor - dogaya da elinize de nazik.",
    hashtags: "#sodakristal #bulasiksabunu #narenciye #dogalbulasik #kastilsabun #bitkiselbazli #dogaltemizlik #mutfaktemizligi #evtemizligi" },
  { day: 9, topic: "Kristal Bentonit Ovma Kremi", post: "post-05", story: "story-05",
    caption: "Duzenli bir cekmece, duzenli bir zihin demek. Kristal bentonit ovma kremimiz artik banyo rutininizin de vazgecilmezi - mineral bazli formuluyle her yuzeyde iz birakmadan temizler.",
    hashtags: "#sodakristal #kristalbentonit #ovmakremi #banyotemizligi #mineraltemizlik #evduzeni #dogaltemizlik #bitkiselbazli" },
  { day: 11, topic: "Kastil Sivi El Sabunu (Bergamot-Nane)", post: "post-06", story: "story-06",
    caption: "Her el yikayista kucuk bir tazelik molasi. Bergamot ve nane esansiyla hazirlanan kastil sivi el sabunumuz, geleneksel sabunun dogalligini modern bir pompa siseda sunuyor.",
    hashtags: "#sodakristal #elsabunu #kastilsabun #bergamot #nane #dogalelsabunu #bitkiselbazli #dogaltemizlik #banyotemizligi" },
  { day: 13, topic: "Anadolu Kastil Camasir Sabunu (Lavanta)", post: "post-07", story: "story-07",
    caption: "Gunesde kurumus keten kokusu, simdi sisede. Anadolu kastil camasir sabunumuzun lavanta serisi, camasir dolabiniza huzur dolu bir koku birakiyor.",
    hashtags: "#sodakristal #camasirsabunu #lavanta #kastilsabun #anadolusabunu #dogalcamasir #bitkiselbazli #dogaltemizlik" },
  { day: 15, topic: "Sirke Bazli Kirec Sokucu", post: "post-08", story: "story-08",
    caption: "Dus camindaki o inatci kirec lekelerine artik hayir deme zamani. Sirke bazli formulumuz sikar sikmaz etki ediyor, camlar leke izi birakmadan pariliyor.",
    hashtags: "#sodakristal #kirecsokucu #sirkelitemizlik #banyotemizligi #dustemizligi #dogalkirecsokucu #bitkiselbazli #dogaltemizlik" },
  { day: 17, topic: "Kristal Bentonit Ovma Kremi", post: "post-09", story: "story-09",
    caption: "Yanik lekeler, kizarmis yaglar... Kristal bentonit hepsine kolay gelsin diyor. Mineral yapisi sayesinde en inatci ocak lekelerinde bile yuzeyi cizmeden etki eder.",
    hashtags: "#sodakristal #kristalbentonit #ovmakremi #ocaktemizligi #mineraltemizlik #mutfaktemizligi #dogaltemizlik #bitkiselbazli" },
  { day: 19, topic: "Kristal Bentonit Ovma Kremi (cok amacli)", post: "post-10", story: "story-10",
    caption: "Tek kavanoz, dort farkli gorev. Ocak, musluk, fayans arasi derzler, firin ici - kristal bentonit ovma kremi evinizin her kosesinde ayni gucu gosteriyor.",
    hashtags: "#sodakristal #kristalbentonit #ovmakremi #cokamaclitemizlik #mineraltemizlik #evtemizligi #dogaltemizlik #bitkiselbazli" },
  { day: 21, topic: "Kastil Sivi El Sabunu (Bergamot-Nane)", post: "post-11", story: "story-11",
    caption: "Banyonuzun estetigi kadar, ellerinize dokunan urunun dogalligi da onemli. Bergamot ve nanenin ferahligi, kastil sabunun yumusakligiyla bulusuyor.",
    hashtags: "#sodakristal #elsabunu #kastilsabun #bergamot #dogalelsabunu #bitkiselbazli #banyotemizligi #dogaltemizlik" },
  { day: 23, topic: "Sirke Bazli Kirec Sokucu (hero cekim)", post: "post-12", story: "story-12",
    caption: "Sirkenin dogal gucu ve limonun ferahligi: kirece karsi guclu, eve karsi nazik bir formul. sodakristal.com'da kesfedin.",
    hashtags: "#sodakristal #kirecsokucu #sirkelimon #dogalkirecsokucu #bitkiselbazli #banyotemizligi #dogaltemizlik" },
  { day: 25, topic: "Anadolu Kastil Bulasik Sabunu (Narenciye)", post: "post-13", story: "story-13",
    caption: "Narenciyenin canliligi, kastil sabunun dogalligiyla mutfaginiza geliyor. Yaglara karsi guclu, ellerinize karsi nazik - bulasik artik bir angarya degil.",
    hashtags: "#sodakristal #bulasiksabunu #narenciye #kastilsabun #dogalbulasik #bitkiselbazli #mutfaktemizligi #dogaltemizlik" },
  { day: 27, topic: "Kristal Bentonit Ovma Kremi (mermer leke)", post: "post-14", story: "story-14",
    caption: "Bu leke hic cikmaz dediginiz anlar icin. Kristal bentonit, mermer ve granit gibi hassas yuzeylerde bile cizmeden, boyamadan inatci lekeleri sokuyor.",
    hashtags: "#sodakristal #kristalbentonit #ovmakremi #mermertemizligi #mineraltemizlik #lekecikarma #dogaltemizlik #bitkiselbazli" },
  { day: 29, topic: "Anadolu Kastil Camasir Sabunu (Lavanta)", post: "post-15", story: "story-15",
    caption: "Yeni yikanmis havlular, lavantanin huzur veren kokusuyla sarili. Anadolu kastil camasir sabunumuz hem camasirlariniza hem dogaya iyi bakiyor.",
    hashtags: "#sodakristal #camasirsabunu #lavanta #anadolusabunu #kastilsabun #dogalcamasir #bitkiselbazli #dogaltemizlik" },
];

function srcFile(n) {
  return path.join(SRC_DIR, `2026 eylül sm-${String(n).padStart(2, "0")}.jpg`);
}

async function copyImages() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  for (let i = 0; i < POSTS.length; i++) {
    const p = POSTS[i];
    const postSrc = srcFile(i + 1);       // sm-01..15 (4:5 feed)
    const storySrc = srcFile(i + 1 + 15); // sm-16..30 (9:16 story)
    const postDest = path.join(UPLOADS_DIR, `soda-kristal-2026-09-${p.post}.jpg`);
    const storyDest = path.join(UPLOADS_DIR, `soda-kristal-2026-09-${p.story}.jpg`);
    // Instagram icin mantikli cozunurluge indir (kaynak dosyalar 4500px+, 7-14MB) —
    // hem site/uploads icin makul boyut hem de PDF'in sismesini onler.
    await sharp(postSrc).resize({ width: 1080, height: 1350, fit: "cover" }).jpeg({ quality: 85 }).toFile(postDest);
    await sharp(storySrc).resize({ width: 1080, height: 1920, fit: "cover" }).jpeg({ quality: 85 }).toFile(storyDest);
    p.imagePath = `/uploads/soda-kristal-2026-09-${p.post}.jpg`;
    p.storyImagePath = `/uploads/soda-kristal-2026-09-${p.story}.jpg`;
  }
}

async function loadFonts(pdfDoc) {
  const regPath = path.join(WEB_DIR, "public", "fonts", "NotoSans-Regular.ttf");
  const boldPath = path.join(WEB_DIR, "public", "fonts", "NotoSans-Bold.ttf");
  try {
    const [rB, bB] = await Promise.all([fs.promises.readFile(regPath), fs.promises.readFile(boldPath)]);
    return { regular: await pdfDoc.embedFont(rB, { subset: false }), bold: await pdfDoc.embedFont(bB, { subset: false }) };
  } catch (e) {
    return { regular: await pdfDoc.embedFont(StandardFonts.Helvetica), bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold) };
  }
}

async function addCoverPage(pdfDoc, plan, regular, bold, brandHex) {
  const PAGE_H = 841.89;
  const TOP_H = Math.round(PAGE_H * 0.55);
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const brandRgb = hexToRgb(brandHex);
  const tintRgb = lightTint(brandHex, 0.07);
  const darkRgb = rgb(0.07, 0.07, 0.12);
  const WHITE = rgb(1, 1, 1);

  page.drawRectangle({ x: 0, y: PAGE_H - TOP_H, width: PAGE_W, height: TOP_H, color: brandRgb });
  page.drawRectangle({ x: PAGE_W - 130, y: PAGE_H - TOP_H, width: 130, height: 130, color: WHITE });
  page.drawEllipse({ x: PAGE_W - 130, y: PAGE_H - TOP_H + 130, xScale: 130, yScale: 130, color: brandRgb });
  page.drawEllipse({ x: 0, y: PAGE_H - TOP_H, xScale: 50, yScale: 50, borderColor: WHITE, borderWidth: 1.5, color: undefined });

  const centerX = PAGE_W / 2;
  const logoMidY = PAGE_H - TOP_H / 2 + 40;
  let belowLogo = logoMidY - 30;

  const nameStr = sanitize(plan.brand.name.toUpperCase());
  const nameSize = 42;
  const nameW = bold.widthOfTextAtSize(nameStr, nameSize);
  page.drawText(nameStr, { x: centerX - nameW / 2, y: logoMidY - 14, size: nameSize, font: bold, color: WHITE });
  belowLogo = logoMidY - 62;

  page.drawLine({ start: { x: centerX - 70, y: belowLogo }, end: { x: centerX + 70, y: belowLogo }, thickness: 0.8, color: rgb(1, 1, 1) });
  belowLogo -= 14;

  const sub = "AYLIK SOSYAL MEDYA ICERIK PLANI";
  const subW = regular.widthOfTextAtSize(sub, 9.5);
  page.drawText(sub, { x: centerX - subW / 2, y: belowLogo, size: 9.5, font: regular, color: WHITE, opacity: 0.8 });

  const bodyTop = PAGE_H - TOP_H;
  const monthStr = `Eylul ${plan.year}`;
  const monthSz = 34;
  const monthW = bold.widthOfTextAtSize(monthStr, monthSz);
  page.drawText(monthStr, { x: PAGE_W / 2 - monthW / 2, y: bodyTop - 56, size: monthSz, font: bold, color: darkRgb });
  page.drawRectangle({ x: PAGE_W / 2 - 28, y: bodyTop - 68, width: 56, height: 3.5, color: brandRgb });

  const platforms = [...new Set(plan.posts.map((p) => (p.platform ?? "instagram").toUpperCase()))].join(" + ");
  const stats = [
    { label: "GONDERI", value: String(plan.posts.length) },
    { label: "PLATFORM", value: platforms },
    { label: "GORSEL HAZIR", value: `${plan.posts.filter((p) => p.imagePath).length} / ${plan.posts.length}` },
  ];
  const gapX = 10;
  const boxW = (PAGE_W - MARGIN * 2 - gapX * 2) / 3;
  const boxH = 68;
  const boxY = bodyTop - 160;
  stats.forEach((s, i) => {
    const bx = MARGIN + i * (boxW + gapX);
    page.drawRectangle({ x: bx, y: boxY, width: boxW, height: boxH, color: tintRgb });
    page.drawRectangle({ x: bx, y: boxY + boxH - 4, width: boxW, height: 4, color: brandRgb });
    const valInner = boxW - 28;
    const valStr = sanitize(s.value);
    const valSize = fitFontSize(valStr, bold, valInner, 20, 9);
    page.drawText(valStr, { x: bx + 14, y: boxY + 36, size: valSize, font: bold, color: darkRgb });
    page.drawText(s.label, { x: bx + 14, y: boxY + 16, size: 7.5, font: regular, color: rgb(0.45, 0.45, 0.55) });
  });

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

  page.drawLine({ start: { x: 0, y: 36 }, end: { x: PAGE_W, y: 36 }, thickness: 0.4, color: rgb(0.88, 0.88, 0.88) });
  page.drawText("Hazirlayan: SocialAI Platform", { x: MARGIN, y: 16, size: 7.5, font: regular, color: rgb(0.55, 0.55, 0.6) });
  const gizliStr = "Gizli - Sadece musteri kullanimicindir.";
  page.drawText(gizliStr, { x: PAGE_W - MARGIN - regular.widthOfTextAtSize(gizliStr, 7.5), y: 16, size: 7.5, font: regular, color: rgb(0.55, 0.55, 0.6) });
}

async function addPostPage(pdfDoc, plan, post, index, regular, bold, brandHex) {
  const PAGE_H = 841.89;
  const HEADER_H = 56;
  const FOOTER_H = 42;
  const CONTENT_TOP = PAGE_H - HEADER_H - 22;
  const CONTENT_BOT = FOOTER_H + 12;

  const brandRgb = hexToRgb(brandHex);
  const darkRgb = rgb(0.08, 0.09, 0.22);
  const grayRgb = rgb(0.42, 0.42, 0.52);
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

  page.drawText(sanitize(plan.brand.name), { x: MARGIN, y: PAGE_H - 26, size: 14, font: bold, color: darkRgb });

  let dateStr = "";
  if (post.scheduledAt) {
    const d = new Date(post.scheduledAt);
    dateStr = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  }
  if (dateStr) {
    const SZ = 12;
    const postLbl = "Post";
    const dotLbl = "  *  ";
    const dateW = bold.widthOfTextAtSize(dateStr, SZ);
    const dotW = bold.widthOfTextAtSize(dotLbl, SZ);
    const postW = regular.widthOfTextAtSize(postLbl, SZ);
    const rightEnd = PAGE_W - MARGIN;
    page.drawText(postLbl, { x: rightEnd - postW, y: PAGE_H - 26, size: SZ, font: regular, color: grayRgb });
    page.drawText(dotLbl, { x: rightEnd - postW - dotW, y: PAGE_H - 26, size: SZ, font: bold, color: brandRgb });
    page.drawText(dateStr, { x: rightEnd - postW - dotW - dateW, y: PAGE_H - 26, size: SZ, font: bold, color: darkRgb });
  }

  page.drawLine({ start: { x: 0, y: PAGE_H - HEADER_H }, end: { x: PAGE_W, y: PAGE_H - HEADER_H }, thickness: 2, color: brandRgb });

  const THUMB_W = 120, THUMB_H = 120, IMG_GAP = 12, MAIN_W = 145, MAIN_H = Math.round(MAIN_W * 4 / 3);
  const IMG_ZONE_W = THUMB_W + IMG_GAP + MAIN_W;
  const thumbX = MARGIN, thumbY = CONTENT_TOP - THUMB_H;
  const mainX = MARGIN + THUMB_W + IMG_GAP, mainY = CONTENT_TOP - MAIN_H;
  const plhColor = rgb(0.91, 0.91, 0.91), plhTxt = rgb(0.62, 0.62, 0.62);

  const embedImg = async (imgPath) => {
    const raw = await fs.promises.readFile(path.join(WEB_DIR, "public", imgPath));
    const lower = imgPath.toLowerCase();
    return lower.endsWith(".png") ? pdfDoc.embedPng(raw) : pdfDoc.embedJpg(raw);
  };

  if (post.imagePath) {
    try {
      const img = await embedImg(post.imagePath);
      page.drawImage(img, { x: thumbX, y: thumbY, width: THUMB_W, height: THUMB_H });
      page.drawImage(img, { x: mainX, y: mainY, width: MAIN_W, height: MAIN_H });
    } catch {
      page.drawRectangle({ x: thumbX, y: thumbY, width: THUMB_W, height: THUMB_H, color: plhColor });
      page.drawRectangle({ x: mainX, y: mainY, width: MAIN_W, height: MAIN_H, color: plhColor });
    }
  }
  page.drawRectangle({ x: thumbX, y: thumbY, width: THUMB_W, height: 15, color: rgb(0, 0, 0), opacity: 0.45 });
  page.drawText("Feed", { x: thumbX + 5, y: thumbY + 4, size: 7, font: bold, color: rgb(1, 1, 1) });

  if (post.storyImagePath) {
    try {
      const img = await embedImg(post.storyImagePath);
      const stH = 90, stW = Math.round(stH * 9 / 16);
      const storyX = thumbX, storyY = thumbY - stH - 10;
      if (storyY >= CONTENT_BOT) {
        page.drawImage(img, { x: storyX, y: storyY, width: stW, height: stH });
        page.drawRectangle({ x: storyX, y: storyY, width: stW, height: 14, color: rgb(0, 0, 0), opacity: 0.45 });
        page.drawText("Story 9:16", { x: storyX + 4, y: storyY + 4, size: 6.5, font: bold, color: rgb(1, 1, 1) });
      }
    } catch {}
  }

  const TEXT_GAP = 22;
  const TEXT_X = MARGIN + IMG_ZONE_W + TEXT_GAP;
  const TEXT_W = PAGE_W - MARGIN - TEXT_X;
  let ty = CONTENT_TOP;

  page.drawText("Aciklama Metni:", { x: TEXT_X, y: ty, size: 12, font: bold, color: darkRgb });
  ty -= 22;

  const capLines = post.caption ? wrapText(sanitize(post.caption), regular, 9.5, TEXT_W) : [];
  for (const line of capLines) {
    if (ty < CONTENT_BOT + 50) break;
    page.drawText(line, { x: TEXT_X, y: ty, size: 9.5, font: regular, color: rgb(0.13, 0.13, 0.13) });
    ty -= 14;
  }
  ty -= 16;

  if (post.hashtags && ty > CONTENT_BOT + 16) {
    page.drawLine({ start: { x: TEXT_X, y: ty + 8 }, end: { x: TEXT_X + TEXT_W, y: ty + 8 }, thickness: 0.4, color: rgb(0.85, 0.85, 0.85) });
    ty -= 6;
    const hashLines = wrapText(sanitize(post.hashtags), regular, 8.5, TEXT_W);
    for (const line of hashLines) {
      if (ty < CONTENT_BOT) break;
      page.drawText(line, { x: TEXT_X, y: ty, size: 8.5, font: regular, color: brandRgb });
      ty -= 12;
    }
  }

  page.drawLine({ start: { x: 0, y: FOOTER_H + 8 }, end: { x: PAGE_W, y: FOOTER_H + 8 }, thickness: 0.4, color: rgb(0.87, 0.87, 0.87) });
  const platStr = (post.platform ?? "instagram");
  page.drawText(sanitize(`${plan.brand.name}  |  ${platStr.charAt(0).toUpperCase()}${platStr.slice(1)}`), { x: MARGIN, y: 18, size: 8, font: regular, color: grayRgb });
  const pgStr = `${index + 1} / ${plan.posts.length}`;
  page.drawText(pgStr, { x: PAGE_W - MARGIN - regular.widthOfTextAtSize(pgStr, 8), y: 18, size: 8, font: regular, color: grayRgb });
}

async function main() {
  console.log("1/4 Gorseller kopyalaniyor...");
  await copyImages();

  console.log("2/4 Marka + Plan + Postlar veritabanina yaziliyor...");
  let brand = await prisma.brand.findUnique({ where: { slug: "soda-kristal" } });
  if (!brand) {
    brand = await prisma.brand.create({
      data: {
        name: "Soda Kristal",
        slug: "soda-kristal",
        websiteUrl: "https://www.sodakristal.com",
        industry: "ecommerce",
        brandColor: "#242850",
      },
    });
  }

  let plan = await prisma.monthlyPlan.findFirst({ where: { brandId: brand.id, month: 9, year: 2026 } });
  if (plan) {
    await prisma.post.deleteMany({ where: { planId: plan.id } });
  } else {
    plan = await prisma.monthlyPlan.create({
      data: { brandId: brand.id, month: 9, year: 2026, status: "planning",
        clientBrief: "Eylul 2026 icerik plani - 15 gonderi, post+story ayni gun ayni saatte (19:00) paylasilir." },
    });
  }

  for (const p of POSTS) {
    const scheduledAt = new Date(2026, 8, p.day, 19, 0, 0); // ay index 8 = Eylul
    await prisma.post.create({
      data: {
        planId: plan.id,
        topic: p.topic,
        platform: "instagram",
        caption: p.caption,
        hashtags: p.hashtags,
        imagePath: p.imagePath,
        storyImagePath: p.storyImagePath,
        scheduledAt,
        status: "approved",
      },
    });
  }

  console.log("3/4 PDF olusturuluyor...");
  const fullPlan = await prisma.monthlyPlan.findUnique({
    where: { id: plan.id },
    include: { brand: true, posts: { orderBy: { scheduledAt: "asc" } } },
  });

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const { regular, bold } = await loadFonts(pdfDoc);
  const brandHex = fullPlan.brand.brandColor ?? "#1a1a2e";

  await addCoverPage(pdfDoc, fullPlan, regular, bold, brandHex);
  for (let i = 0; i < fullPlan.posts.length; i++) {
    await addPostPage(pdfDoc, fullPlan, fullPlan.posts[i], i, regular, bold, brandHex);
  }

  const pdfBytes = await pdfDoc.save();
  const fileName = `${fullPlan.brand.slug}-plan-${fullPlan.month}-${fullPlan.year}.pdf`;
  ensureReportsDir();
  const outPath = path.join(REPORTS_DIR, fileName);
  await fs.promises.writeFile(outPath, pdfBytes);

  await prisma.monthlyPlan.update({ where: { id: plan.id }, data: { reportPath: fileName, status: "ready" } });

  console.log("4/4 Tamam.");
  console.log("Plan ID:", plan.id);
  console.log("PDF:", outPath);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
