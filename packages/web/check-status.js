const { PrismaClient } = require("../../node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url: "file:./dev.db" } } });
prisma.post.findMany({ orderBy: { id: "asc" }, select: { id: true, status: true, platform: true, qualityScore: true, hashtags: true, imagePrompt: true } }).then(posts => {
  const s = {};
  posts.forEach(p => {
    const hasTag = p.hashtags ? "Y" : "N";
    const hasPrm = p.imagePrompt ? "Y" : "N";
    const Q = p.qualityScore != null ? " Q:"+p.qualityScore : "";
    console.log("["+p.id+"] ["+p.platform+"] ["+p.status+"] tag:"+hasTag+" prm:"+hasPrm+Q);
    s[p.status] = (s[p.status]||0)+1;
  });
  console.log("\nSummary:", JSON.stringify(s));
}).catch(console.error).finally(() => prisma.$disconnect());
