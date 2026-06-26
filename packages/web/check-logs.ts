import "dotenv/config";
import prisma from "./src/lib/db";

async function main() {
  const logs = await prisma.agentLog.findMany({
    where: { agentName: { contains: "Report" } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  logs.forEach(l => console.log(`[${l.createdAt.toISOString()}] ${l.action}`));
  await prisma.$disconnect();
}

main();
