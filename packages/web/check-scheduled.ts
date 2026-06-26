import "dotenv/config";
import prisma from "./src/lib/db";

async function main() {
  const posts = await prisma.post.findMany({
    where: { planId: 1 },
    select: { id: true, scheduledAt: true, topic: true },
    orderBy: { id: "asc" },
  });
  posts.forEach(p => console.log(`[${p.id}] scheduledAt=${p.scheduledAt} topic=${p.topic?.slice(0, 40)}`));
  await prisma.$disconnect();
}

main();
