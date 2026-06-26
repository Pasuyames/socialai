process.env.DATABASE_URL = "file:./dev.db";
const clientPath = "C:\\Users\\musta\\Desktop\\SocialAI\\node_modules\\.pnpm\\@prisma+client@5.22.0_prisma@5.22.0\\node_modules\\@prisma\\client";
const {PrismaClient} = require(clientPath);
const p = new PrismaClient();
async function main() {
  const posts = await p.post.findMany({select:{id:true,status:true,platform:true,caption:true,hashtags:true,qualityScore:true,imagePrompt:true}});
  console.log("=== POSTS STATUS ===");
  const counts = {};
  for (const post of posts) {
    counts[post.status] = (counts[post.status]||0)+1;
    const hasCaption = post.caption ? "✓cap" : "✗cap";
    const hasHashtag = post.hashtags ? "✓tag" : "✗tag";
    const hasPrompt  = post.imagePrompt ? "✓prm" : "✗prm";
    const score = post.qualityScore ? `Q:${post.qualityScore}` : "";
    console.log(`  [${post.id.toString().padStart(2)}] [${(post.platform||'?').padEnd(9)}] [${(post.status||'?').padEnd(20)}] ${hasCaption} ${hasHashtag} ${hasPrompt} ${score}`);
  }
  console.log("\nSummary:", JSON.stringify(counts));
}
main().catch(e=>console.error("ERR:", e.message)).finally(()=>p.$disconnect());
