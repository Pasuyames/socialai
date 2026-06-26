import { NextResponse }  from "next/server";
import { Orchestrator }  from "@/lib/agents/Orchestrator";
import { PLAN_STATUS }   from "@/lib/constants";
import { authorizePlan } from "@/lib/authz";
import { rateLimitOrError } from "@/lib/rateLimit";
import prisma            from "@/lib/db";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const planId  = parseInt(id);

    const az = await authorizePlan(planId);
    if (!az.ok) return az.error;

    const limited = rateLimitOrError(`ai:${az.orgId}`, 30, 600_000);
    if (limited) return limited;

    const posts = await prisma.post.findMany({
      where: { planId, status: { in: ["ideation", "writing"] } },
      select: { id: true },
    });

    if (posts.length === 0) {
      return NextResponse.json({ error: "Yazılacak gönderi bulunamadı." }, { status: 400 });
    }

    // Arka planda çalıştır
    (async () => {
      await prisma.monthlyPlan.update({
        where: { id: planId },
        data:  { status: PLAN_STATUS.POST_GENERATION },
      });

      let success = 0;
      for (const post of posts) {
        const r = await Orchestrator.startPostCreation(post.id);
        if (r.success) success++;
      }

      await prisma.monthlyPlan.update({
        where: { id: planId },
        data:  { status: success > 0 ? PLAN_STATUS.IMAGE_GENERATION : PLAN_STATUS.POST_GENERATION_FAILED },
      });
    })().catch(async (err) => {
      console.error("[generate-posts]", err);
      await prisma.monthlyPlan.update({ where: { id: planId }, data: { status: PLAN_STATUS.POST_GENERATION_FAILED } });
    });

    return NextResponse.json({ message: "Metin yazımı başlatıldı.", total: posts.length });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
