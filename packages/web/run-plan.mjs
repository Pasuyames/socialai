/**
 * %100 Gıda için Haziran 2026 aylık plan oluştur ve pipeline'ı başlat.
 * Çalıştır: node run-plan.mjs
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// 1. Markayı bul
const brand = await db.brand.findFirst({ where: { name: '%100 Gıda' } });
if (!brand) { console.error('Marka bulunamadı!'); process.exit(1); }
console.log(`✓ Marka: ${brand.name} (id: ${brand.id}, sektör: ${brand.industry})`);

// 2. Haziran 2026 planı zaten var mı?
const existing = await db.monthlyPlan.findFirst({ where: { brandId: brand.id, month: 6, year: 2026 } });
if (existing) {
  console.log(`✓ Plan zaten mevcut (id: ${existing.id}, durum: ${existing.status})`);
  console.log('\nPlan ID:', existing.id);
  console.log('Planı sıfırlamak için aşağıdaki komutu çalıştır:');
  console.log('  node run-plan.mjs --reset');
  await db.$disconnect();
  process.exit(0);
}

// 3. Planı oluştur
const plan = await db.monthlyPlan.create({
  data: {
    brandId: brand.id,
    month: 6,
    year: 2026,
    clientBrief: '%100 Gıda için Haziran 2026 sosyal medya planı. Glutensiz ürünler, sağlıklı yaşam tarifleri ve ürün tanıtımı odaklı içerikler.',
    status: 'planning',
  },
});

await db.agentLog.create({
  data: {
    agentName: 'Script',
    action: `Haziran 2026 planı script ile oluşturuldu (id: ${plan.id})`,
    targetType: 'Plan',
    targetId: plan.id,
  },
});

console.log(`✓ Plan oluşturuldu (id: ${plan.id})`);
await db.$disconnect();

// 4. Orchestrator'ı HTTP ile tetikle
console.log('\n→ Orchestrator tetikleniyor via /api/plans/ideate...');
try {
  const res = await fetch(`http://localhost:3000/api/plans/${plan.id}/ideate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-trigger': 'true' },
  });
  const text = await res.text();
  console.log(`  HTTP ${res.status}: ${text.slice(0, 200)}`);
} catch (e) {
  console.warn('  HTTP çağrısı başarısız:', e.message);
}

console.log('\n✓ Tamamlandı. Logları izlemek için: node watch-logs.mjs', plan.id);
