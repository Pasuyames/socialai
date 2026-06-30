import { NextResponse }  from "next/server";
import { PLAN_STATUS }   from "@/lib/constants";
import { authorizePlan } from "@/lib/authz";
import { rateLimitOrError } from "@/lib/rateLimit";
import { agentQueue }    from "@/lib/queues";
import { JOB_NAMES }     from "@socialai/common";
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

    await prisma.monthlyPlan.update({
      where: { id: planId },
      data:  { status: PLAN_STATUS.POST_GENERATION },
    });

    // In-process senkron döngü YERİNE BullMQ kuyruğuna ekle. Worker dayanıklı
    // şekilde işler: web deploy/restart'ında ölmez, concurrency + rate-limit +
    // attempts/backoff worker tarafında. İşler /admin/queues'ten izlenir.
    // skipImages: true → görseller ayrı "Görsel Üret" adımıyla tetiklenir
    // (worker, tüm metinler bitince planı IMAGE_GENERATION'a çeker).
    const jobs = await agentQueue.addBulk(
      posts.map((p) => ({
        name: JOB_NAMES.PROCESS_POST,
        data: { postId: p.id, planId, skipImages: true },
        opts: {
          attempts: 2,
          backoff: { type: "exponential" as const, delay: 5000 },
          removeOnComplete: false,
          removeOnFail: false,
        },
      })),
    );

    return NextResponse.json({
      message: "Metin yazımı kuyruğa eklendi.",
      total: posts.length,
      enqueued: jobs.length,
    });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
