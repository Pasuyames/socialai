process.env.DATABASE_URL = "file:./dev.db";
const clientPath = "C:\\Users\\musta\\Desktop\\SocialAI\\node_modules\\.pnpm\\@prisma+client@5.22.0_prisma@5.22.0\\node_modules\\@prisma\\client";
const {PrismaClient} = require(clientPath);
const p = new PrismaClient();
async function main() {
  // Reset post 1 to writing so it gets reprocessed (Engagement + PromptEngineer)
  await p.post.update({where:{id:1}, data:{status:"writing"}});
  console.log("Post 1 reset to writing");
}
main().catch(e=>console.error("ERR:", e.message)).finally(()=>p.$disconnect());
