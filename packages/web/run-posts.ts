import db from "@/lib/db";
import { Orchestrator } from "@/lib/agents/Orchestrator";

async function main() {
  const plan = await db.monthlyPlan.findUnique({
    where: { id: 3 },
    include: { posts: { where: { status: "ideation" }, select: { id: true, topic: true, platform: true } } },
  });

  if (!plan) { console.error("Plan bulunamadı!"); process.exit(1); }
  console.log(`✓ Plan: ${plan.month}/${plan.year} — ${plan.posts.length} post yazılacak`);

  const result = await Orchestrator.processAllPostsInPlan(plan.id);
  console.log("\n✓ Tamamlandı:", result);
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error("HATA:", e.message);
  await db.$disconnect();
  process.exit(1);
});
