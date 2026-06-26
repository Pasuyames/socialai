import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const posts = await db.post.findMany({
  where: { planId: 3 },
  select: { id: true, topic: true, platform: true, status: true, caption: true, hashtags: true, imagePrompt: true, qualityScore: true, revisionNotes: true },
  orderBy: { id: 'asc' },
});

// İlk iyi post
const good = posts.find(p => p.status === 'client_review');
if (good) {
  console.log('=== ÖRNEK BAŞARILI POST ===');
  console.log(`Platform: ${good.platform} | Kalite: ${good.qualityScore ?? 'N/A'}`);
  console.log(`Konu: ${good.topic}`);
  console.log(`\nCaption:\n${good.caption}`);
  console.log(`\nHashtags: ${good.hashtags}`);
  console.log(`\nImagen Prompt:\n${good.imagePrompt?.slice(0, 200)}...`);
}

// Sorunlu post
const bad = posts.find(p => p.status === 'needs_human_intervention');
if (bad) {
  console.log('\n=== SORUNLU POST ===');
  console.log(`Konu: ${bad.topic}`);
  console.log(`Revizyon Notu: ${bad.revisionNotes}`);
  console.log(`Caption: ${bad.caption?.slice(0, 200)}`);
}

await db.$disconnect();
