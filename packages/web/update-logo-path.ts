import "dotenv/config";
import prisma from "./src/lib/db";

async function main() {
  await prisma.brand.update({
    where: { slug: "penti-1778102660311" },
    data:  { logoPath: "/logos/penti-1778102660311-logo-white.png" },
  });
  console.log("logoPath updated to white PNG.");
  await prisma.$disconnect();
}
main();
