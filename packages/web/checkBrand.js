const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const brand = await prisma.brand.findUnique({
    where: { id: 1 },
  });
  console.log('Test result for Brand ID: 1');
  console.log(brand);
}
main()
  .catch(e => { 
    console.error(e);
    process.exit(1);
  })
  .finally(async () => { 
    await prisma.$disconnect();
  });
