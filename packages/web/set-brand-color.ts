import "dotenv/config";
import prisma from "./src/lib/db";

async function main() {
  const brands = await prisma.brand.findMany({ select: { id: true, name: true, slug: true, brandColor: true } });
  console.log("Brands:", JSON.stringify(brands, null, 2));

  const brandSlug = process.argv[2];
  const color = process.argv[3];

  if (brandSlug && color) {
    const brand = await prisma.brand.update({
      where: { slug: brandSlug },
      data: { brandColor: color },
      select: { id: true, name: true, brandColor: true },
    });
    console.log(`Updated → ${brand.name}: ${brand.brandColor}`);
  }
  await prisma.$disconnect();
}

main();
