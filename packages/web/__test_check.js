const path = require("path");
process.env.DATABASE_URL = "file:" + path.resolve("C:\\Users\\musta\\Desktop\\SocialAI\\packages\\web\\prisma\\dev.db");
const clientPath = "C:\\Users\\musta\\Desktop\\SocialAI\\packages\\web\\node_modules\\.prisma\\client";
const {PrismaClient} = require(clientPath);
const p = new PrismaClient();
async function main() {
  const brands = await p.brand.findMany();
  console.log("Brand count:", brands.length);
  const logs = await p.agentLog.findMany({take:5, orderBy:{createdAt:"desc"}});
  console.log("Recent logs:", JSON.stringify(logs.map(l=>({agent:l.agentName,action:l.action.slice(0,60)})),null,2));
}
main().catch(e=>console.error("ERR:", e.message)).finally(()=>p.$disconnect());
