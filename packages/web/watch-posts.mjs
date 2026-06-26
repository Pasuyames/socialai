import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function poll() {
  const posts = await db.post.findMany({
    where: { planId: 3 },
    select: { id: true, status: true, platform: true, topic: true },
    orderBy: { id: 'asc' },
  });
  const plan = await db.monthlyPlan.findUnique({ where: { id: 3 }, select: { status: true } });

  const counts = posts.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  console.clear();
  console.log(`Plan durumu: ${plan?.status} | ${new Date().toLocaleTimeString('tr-TR')}`);
  console.log('─'.repeat(60));
  Object.entries(counts).forEach(([s, c]) => console.log(`  ${s.padEnd(25)} ${c} post`));
  console.log('─'.repeat(60));
  posts.filter(p => !['ideation'].includes(p.status)).forEach(p => {
    console.log(`  [${p.platform?.padEnd(9)}] ${p.status.padEnd(22)} ${p.topic?.slice(0,40)}`);
  });

  const done = ['review', 'ready'].includes(plan?.status ?? '');
  if (done) { console.log('\n✓ Pipeline tamamlandı!'); await db.$disconnect(); process.exit(0); }
}

setInterval(poll, 4000);
await poll();
