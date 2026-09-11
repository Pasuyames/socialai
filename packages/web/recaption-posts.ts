/**
 * Bir plandaki tüm postların metnini yeniden üretir.
 * Sadece metin hattı: ContentWriter -> EditorInChief. Görseller değişmez.
 *
 * Kullanım: pnpm exec tsx recaption-posts.ts <planId>
 *
 * NOT: Bu script eskiden CopywriterAgent kullanıyordu. Ana üretim hattı ve her
 * iki revizyon ucu ContentWriter'a (caption + hashtags + hook tek structured
 * JSON) geçtiği için burada da aynı motor kullanılır — aksi halde bu script'ten
 * geçen postlar üretilenlerden FARKLI formatta (hashtag'ler caption'a gömülü,
 * hook alanı güncellenmemiş) çıkıyordu.
 */
import "dotenv/config";
import prisma from "./src/lib/db";
import { ContentWriterAgent } from "./src/lib/agents/ContentWriter";
import { EditorInChiefAgent } from "./src/lib/agents/EditorInChief";
import { POST_STATUS }        from "./src/lib/constants";

const PLAN_ID   = parseInt(process.argv[2] ?? "");
const MAX_TRIES = 3;

if (isNaN(PLAN_ID)) {
  console.error("Kullanim: pnpm exec tsx recaption-posts.ts <planId>");
  process.exit(1);
}

async function main() {
  const posts = await prisma.post.findMany({
    where:   { planId: PLAN_ID },
    select:  { id: true, platform: true, topic: true },
    orderBy: { id: "asc" },
  });

  if (posts.length === 0) {
    console.log(`plan ${PLAN_ID} icin post bulunamadi.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`${posts.length} post yeniden yazilacak (plan ${PLAN_ID})\n`);

  const writer = new ContentWriterAgent();
  const editor = new EditorInChiefAgent();

  for (const post of posts) {
    console.log(`[${post.id}] ${(post.platform ?? "?").toUpperCase()} — ${(post.topic ?? "").slice(0, 55)}`);

    let passed = false;

    for (let t = 1; t <= MAX_TRIES; t++) {
      // ContentWriter her çalışma öncesi status'u sıfırla
      await prisma.post.update({ where: { id: post.id }, data: { status: POST_STATUS.IDEATION } });

      const ok1 = await writer.execute(post.id);
      if (!ok1) { console.log(`  [${t}] ContentWriter basarisiz`); break; }

      const ok2 = await editor.execute(post.id);
      if (!ok2) { console.log(`  [${t}] EditorInChief basarisiz`); break; }

      const p = await prisma.post.findUnique({
        where: { id: post.id }, select: { status: true, qualityScore: true, caption: true },
      });
      const words = (p?.caption ?? "").split(/\s+/).filter(Boolean).length;
      console.log(`  [${t}] ${p?.status} | skor:${p?.qualityScore} | ${words} kelime`);

      if (p?.status === POST_STATUS.REVIEWED) { passed = true; break; }
    }

    // Kalite eşiğini geçemeyen metni müşteriye GÖSTERME — insana yönlendir.
    // (Eskiden sonuç ne olursa olsun koşulsuz client_review yazılıyordu.)
    if (!passed) {
      await prisma.post.update({ where: { id: post.id }, data: { status: POST_STATUS.NEEDS_HUMAN } });
      console.log(`  -> needs_human_intervention (kalite esigi gecilemedi)\n`);
      continue;
    }

    // Görsel zaten hazır — doğrudan client_review
    await prisma.post.update({ where: { id: post.id }, data: { status: POST_STATUS.CLIENT_REVIEW } });
    console.log(`  -> client_review\n`);
  }

  console.log("Bitti.");
  await prisma.$disconnect();
}

main();
