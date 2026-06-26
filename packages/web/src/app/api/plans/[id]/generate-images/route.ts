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

    // Maliyet-DoS koruması — org başına pahalı görsel üretimi sınırı
    const limited = rateLimitOrError(`ai:${az.orgId}`, 30, 600_000);
    if (limited) return limited;

    const posts = await prisma.post.findMany({
      where: { planId, status: "image_prompt_ready" },
      select: { id: true },
    });

    if (posts.length === 0) {
      return NextResponse.json({ error: "Görsel üretilecek gönderi bulunamadı." }, { status: 400 });
    }

    (async () => {
      await prisma.monthlyPlan.update({
        where: { id: planId },
        data:  { status: PLAN_STATUS.IMAGE_GENERATION },
      });

      let success = 0;
      for (let i = 0; i < posts.length; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 30_000)); // 30s between posts — Imagen quota
        const result = await Orchestrator.startImageGenerationWithRetry(posts[i].id);
        if (result.success) success++;
      }

      await prisma.monthlyPlan.update({
        where: { id: planId },
        data:  { status: PLAN_STATUS.REVIEW },
      });
    })().catch(async (err) => {
      console.error("[generate-images]", err);
      await prisma.monthlyPlan.update({ where: { id: planId }, data: { status: PLAN_STATUS.IMAGE_GENERATION } });
    });

    return NextResponse.json({ message: "Görsel üretim başlatıldı.", total: posts.length });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
