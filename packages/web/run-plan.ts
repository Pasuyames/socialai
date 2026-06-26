import db from "@/lib/db";
import { Orchestrator } from "@/lib/agents/Orchestrator";

async function main() {
  const brand = await db.brand.findFirst({ where: { name: "%100 Gıda" } });
  if (!brand) { console.error("Marka bulunamadı!"); process.exit(1); }
  console.log(`✓ Marka: ${brand.name} (id: ${brand.id})`);

  const existing = await db.monthlyPlan.findFirst({ where: { brandId: brand.id, month: 6, year: 2026 } });
  if (existing) {
    console.log(`⚠ Plan zaten mevcut (id: ${existing.id}, durum: ${existing.status}). Mevcut planı kullanıyoruz.`);
    console.log("\n→ Orchestrator startMonthlyPlan çağrılıyor...");
    const result = await Orchestrator.startMonthlyPlan(existing.id);
    console.log("Sonuç:", result);
    await db.$disconnect();
    return;
  }

  const plan = await db.monthlyPlan.create({
    data: {
      brandId: brand.id,
      month: 6,
      year: 2026,
      clientBrief: "Glutensiz ve sağlıklı yaşam odaklı ürünler. Tarif içerikleri, ürün tanıtımı ve sağlıklı beslenme eğitimi.",
      status: "planning",
    },
  });

  console.log(`✓ Plan oluşturuldu (id: ${plan.id})`);
  console.log("\n→ Orchestrator.startMonthlyPlan çağrılıyor...");

  const result = await Orchestrator.startMonthlyPlan(plan.id);
  console.log("Sonuç:", result);

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error("HATA:", e.message);
  await db.$disconnect();
  process.exit(1);
});
