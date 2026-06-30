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

    await prisma.monthlyPlan.update({
      where: { id: planId },
      data:  { status: PLAN_STATUS.IMAGE_GENERATION },
    });

    // In-process arka plan döngüsü (30sn aralıklı, web restart'ında ölen) YERİNE
    // her gönderiyi BullMQ görsel kuyruğuna ekle. Worker dayanıklı işler:
    // concurrency + rate-limit (Imagen kotası) + attempts/backoff worker'da.
    // Tüm görseller bitince worker planı REVIEW'a çeker. /admin/queues'ten izlenir.
    const jobs = await agentQueue.addBulk(
      posts.map((p) => ({
        name: JOB_NAMES.PROCESS_IMAGE,
        data: { postId: p.id, planId },
        opts: {
          attempts: 2,
          backoff: { type: "exponential" as const, delay: 5000 },
          removeOnComplete: false,
          removeOnFail: false,
        },
      })),
    );

    return NextResponse.json({
      message: "Görsel üretimi kuyruğa eklendi.",
      total: posts.length,
      enqueued: jobs.length,
    });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
