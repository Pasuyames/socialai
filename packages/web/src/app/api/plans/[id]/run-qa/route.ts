import { NextResponse }      from "next/server";
import { VisualInspectorAgent } from "@/lib/agents/VisualInspector";
import { PLAN_STATUS }          from "@/lib/constants";
import { authorizePlan }        from "@/lib/authz";
import { rateLimitOrError }     from "@/lib/rateLimit";
import prisma                   from "@/lib/db";

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
      where: { planId, imagePath: { not: null }, status: "qc_review" },
      select: { id: true },
    });

    if (posts.length === 0) {
      return NextResponse.json({ error: "QC için görsel bekleyen gönderi bulunamadı." }, { status: 400 });
    }

    (async () => {
      const inspector = new VisualInspectorAgent();
      for (const post of posts) {
        await inspector.execute(post.id);
      }
      await prisma.monthlyPlan.update({
        where: { id: planId },
        data:  { status: PLAN_STATUS.REVIEW },
      });
    })().catch(console.error);

    return NextResponse.json({ message: "Görsel kalite kontrolü başlatıldı.", total: posts.length });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
