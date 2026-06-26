/**
 * Marka logosu indir, dominant rengini çıkar, beyaz PNG versiyonu oluştur.
 * Kullanım: npx tsx extract-brand-assets.ts [brandSlug]
 */
import "dotenv/config";
import path from "path";
import fs from "fs";
import prisma from "./src/lib/db";
import { fetchBrandLogoUrl, downloadLogo, extractDominantColor } from "./src/lib/utils/brandColorExtractor";

async function main() {
  const slugArg = process.argv[2];
  const where   = slugArg ? { slug: slugArg } : undefined;

  const brands = await prisma.brand.findMany({
    where,
    select: { id: true, name: true, slug: true, websiteUrl: true },
  });

  if (brands.length === 0) {
    console.log("Marka bulunamadı.");
    return;
  }

  const logoDir = path.join(process.cwd(), "public", "logos");

  for (const brand of brands) {
    console.log(`\n[${brand.name}] ${brand.websiteUrl ?? "URL yok"}`);

    if (!brand.websiteUrl) {
      console.log("  Atlandı: websiteUrl yok.");
      continue;
    }

    // 1. Logo URL bul
    console.log("  Logo URL aranıyor...");
    const logoUrl = await fetchBrandLogoUrl(brand.websiteUrl);
    if (!logoUrl) {
      console.log("  Logo bulunamadı.");
      continue;
    }
    console.log(`  Logo URL: ${logoUrl}`);

    // 2. İndir
    const logoPath = await downloadLogo(logoUrl, logoDir, brand.slug);
    if (!logoPath) {
      console.log("  İndirme başarısız.");
      continue;
    }
    console.log(`  Kaydedildi: ${logoPath}`);

    // 3. Renk çıkar
    const color = await extractDominantColor(logoPath);
    console.log(`  Dominant renk: ${color}`);

    // 4. Beyaz PNG versiyonu oluştur (PDF kapağı için)
    let whitePngPublic = `/logos/${path.basename(logoPath)}`;
    try {
      // SVG ise beyaz renkle PNG'ye çevir; PNG ise doğrudan kullan
      const ext = path.extname(logoPath).toLowerCase();
      if (ext === ".svg") {
        const sharp = (await import("sharp")).default;
        let svgContent = await fs.promises.readFile(logoPath, "utf-8");
        // Tüm renkleri beyaza çevir
        svgContent = svgContent.replace(/#[0-9a-fA-F]{3,6}/g, "#FFFFFF");
        const whitePngPath = logoPath.replace(".svg", "-white.png");
        await sharp(Buffer.from(svgContent)).resize(280, null).png().toFile(whitePngPath);
        whitePngPublic = `/logos/${path.basename(whitePngPath)}`;
        console.log(`  Beyaz PNG: ${whitePngPath}`);
      }
    } catch (e: any) {
      console.warn(`  Beyaz PNG oluşturulamadı: ${e.message}`);
    }

    // 5. DB güncelle
    await prisma.brand.update({
      where: { id: brand.id },
      data:  { brandColor: color, logoPath: whitePngPublic },
    });
    console.log(`  DB güncellendi — brandColor: ${color}, logoPath: ${whitePngPublic}`);
  }

  await prisma.$disconnect();
}

main();
