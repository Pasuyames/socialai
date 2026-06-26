process.env.DATABASE_URL = "file:./dev.db";
const clientPath = "C:\\Users\\musta\\Desktop\\SocialAI\\node_modules\\.pnpm\\@prisma+client@5.22.0_prisma@5.22.0\\node_modules\\@prisma\\client";
const {PrismaClient} = require(clientPath);
const p = new PrismaClient();
async function main() {
  const logs = await p.agentLog.findMany({orderBy:{createdAt:"asc"}, take:60});
  console.log("=== AGENT LOGS ===");
  for (const l of logs) {
    const t = new Date(l.createdAt).toLocaleTimeString("tr-TR");
    console.log(`[${t}] [${l.agentName.slice(0,22).padEnd(22)}] ${l.action.slice(0,90)}`);
  }
  
  const plan = await p.monthlyPlan.findFirst({select:{id:true,status:true,trendReport:true,directorBrief:true}});
  console.log("\n=== PLAN ===");
  console.log("status:", plan?.status);
  console.log("trendReport:", plan?.trendReport ? "SET ("+plan.trendReport.length+")" : "null");
  console.log("directorBrief:", plan?.directorBrief ? "SET ("+plan.directorBrief.length+")" : "null");
  
  const posts = await p.post.findMany({select:{id:true,topic:true,status:true,platform:true,hook:true}});
  console.log("\n=== POSTS ("+posts.length+") ===");
  for (const post of posts) {
    console.log(`  [${post.id}] [${(post.platform||'?').padEnd(9)}] [${(post.status||'?').padEnd(22)}] ${(post.topic||'').slice(0,55)}`);
  }
}
main().catch(e=>console.error("ERR:", e.message)).finally(()=>p.$disconnect());
