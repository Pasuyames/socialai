import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { PromptEngineerAgent } from "@/lib/agents/PromptEngineer";
import { authorizePlan } from "@/lib/authz";
import { rateLimitOrError } from "@/lib/rateLimit";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const planId = parseInt(id);

  const az = await authorizePlan(planId);
  if (!az.ok) return az.error;

  const limited = rateLimitOrError(`ai:${az.orgId}`, 30, 600_000);
  if (limited) return limited;

  const posts = await prisma.post.findMany({ where: { planId } });
  const agent = new PromptEngineerAgent();

  // Arka planda çalıştır, timeout yeme
  const run = async () => {
    for (const post of posts) {
      await agent.execute(post.id);
    }
    await prisma.monthlyPlan.update({
      where: { id: planId },
      data: { status: "image_prompt_ready" },
    });
  };
  run().catch(console.error);

  return NextResponse.json({ message: "PromptEngineer arka planda çalışıyor.", total: posts.length });
}
