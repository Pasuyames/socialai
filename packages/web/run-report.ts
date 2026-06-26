import "dotenv/config";
import { ReportGeneratorAgent } from "./src/lib/agents/ReportGenerator";

async function main() {
  const planId = parseInt(process.argv[2] ?? "1");
  console.log("Plan ID:", planId, "| cwd:", process.cwd());
  const agent = new ReportGeneratorAgent();
  try {
    const ok = await agent.execute(planId);
    console.log(ok ? "PDF başarıyla oluşturuldu." : "PDF oluşturulamadı.");
    process.exit(ok ? 0 : 1);
  } catch (e: any) {
    console.error("UNCAUGHT:", e.message, e.stack);
    process.exit(1);
  }
}

main();
