import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const planId = parseInt(process.argv[2] ?? '3');

let lastId = 0;
console.log(`Plan ${planId} logları izleniyor...\n`);

async function poll() {
  const plan = await db.monthlyPlan.findUnique({ where: { id: planId }, select: { status: true } });
  const logs = await db.agentLog.findMany({
    where: { targetId: planId, targetType: 'Plan', id: { gt: lastId } },
    orderBy: { id: 'asc' },
  });
  if (logs.length > 0) {
    logs.forEach(l => {
      console.log(`[${l.createdAt.toISOString().slice(11,19)}] ${l.agentName}`);
      console.log(`  ${l.action.slice(0, 120)}`);
    });
    lastId = logs[logs.length - 1].id;
  }
  console.log(`  → Plan durumu: ${plan?.status}`);
  if (['ideation_ready','post_generation_failed','ready'].includes(plan?.status ?? '')) {
    console.log('\n✓ Pipeline tamamlandı.');
    await db.$disconnect();
    process.exit(0);
  }
}

// Her 5 saniyede poll et
setInterval(poll, 5000);
await poll();
