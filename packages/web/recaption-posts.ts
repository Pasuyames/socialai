/**
 * Plan 1'deki tum postlarin caption'larini yeniden uretir (60 kelime limiti).
 * Sadece metin pipeline: Copywriter -> EditorInChief
 * Gorseller ve diger alanlar degismez.
 */
import "dotenv/config";
import prisma from "./src/lib/db";
import { CopywriterAgent }    from "./src/lib/agents/Copywriter";
import { EditorInChiefAgent } from "./src/lib/agents/EditorInChief";
import { POST_STATUS }        from "./src/lib/constants";

const PLAN_ID    = parseInt(process.argv[2] ?? "1");
const MAX_TRIES  = 3;

async function main() {
  const posts = await prisma.post.findMany({
    where:   { planId: PLAN_ID },
    select:  { id: true, platform: true, topic: true },
    orderBy: { id: "asc" },
  });

  console.log(`${posts.length} post yeniden yazilacak (plan ${PLAN_ID})\n`);

  const copy   = new CopywriterAgent();
  const editor = new EditorInChiefAgent();

  for (const post of posts) {
    console.log(`[${post.id}] ${(post.platform ?? "?").toUpperCase()} — ${(post.topic ?? "").slice(0, 55)}`);

    for (let t = 1; t <= MAX_TRIES; t++) {
      // Copywriter her calisma oncesi status'u sifirla
      await prisma.post.update({ where: { id: post.id }, data: { status: POST_STATUS.IDEATION } });

      const ok1 = await copy.execute(post.id);
      if (!ok1) { console.log(`  [${t}] Copywriter basarisiz`); break; }

      const ok2 = await editor.execute(post.id);
      if (!ok2) { console.log(`  [${t}] EditorInChief basarisiz`); break; }

      const p = await prisma.post.findUnique({
        where: { id: post.id }, select: { status: true, qualityScore: true, caption: true },
      });
      const words = (p?.caption ?? "").split(/\s+/).filter(Boolean).length;
      console.log(`  [${t}] ${p?.status} | skor:${p?.qualityScore} | ${words} kelime`);

      if (p?.status === POST_STATUS.REVIEWED) break;
    }

    // Gorsel zaten hazir — direkt client_review
    await prisma.post.update({ where: { id: post.id }, data: { status: POST_STATUS.CLIENT_REVIEW } });
    console.log(`  -> client_review\n`);
  }

  console.log("Bitti.");
  await prisma.$disconnect();
}

main();
