import "dotenv/config";
import prisma from "./src/lib/db";

async function main() {
  const b = await prisma.brand.findFirst({ select: { name: true, websiteUrl: true, brandColor: true, slug: true } });
  console.log(JSON.stringify(b));
  await prisma.$disconnect();
}
main();
