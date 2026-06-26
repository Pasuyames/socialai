process.env.DATABASE_URL = "file:./dev.db";
const clientPath = "C:\\Users\\musta\\Desktop\\SocialAI\\node_modules\\.pnpm\\@prisma+client@5.22.0_prisma@5.22.0\\node_modules\\@prisma\\client";
const {PrismaClient} = require(clientPath);
const p = new PrismaClient();
async function main() {
  const logs = await p.agentLog.findMany({
    orderBy:{createdAt:"desc"}, 
    take:20,
    where:{targetType:"Post", targetId:{in:[1,2]}}
  });
  for (const l of logs) {
    const t = new Date(l.createdAt).toLocaleTimeString("tr-TR");
    console.log(`[${t}] Post${l.targetId} [${l.agentName.slice(0,22)}] ${l.action.slice(0,80)}`);
  }
}
main().catch(e=>console.error("ERR:", e.message)).finally(()=>p.$disconnect());
