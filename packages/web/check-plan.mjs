import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const plan = await db.monthlyPlan.findUnique({ where: { id: 3 }, include: { posts: { select: { id: true, topic: true, platform: true, status: true, scheduledAt: true } } } });
console.log('Plan durumu:', plan?.status);
console.log('Post sayısı:', plan?.posts?.length ?? 0);
plan?.posts?.forEach((p, i) => console.log(`  ${i+1}. [${p.platform}] ${p.topic?.slice(0,60)} — ${p.status}`));
await db.$disconnect();
