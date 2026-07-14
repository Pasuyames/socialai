import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, Activity, BrainCircuit, Download } from "lucide-react";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import PlanActionButtons from "./PlanActionButtons";
import DeletePlanButton from "./DeletePlanButton";
import PostActions from "./PostActions";
import ClientLinkButton from "./ClientLinkButton";
import { BentoCard } from "@/components/ui/Bento";
import { AgentTimeline, type AgentLogEntry } from "@/components/plans/AgentTimeline";
import { PostPreviewGrid, type PostPreviewData } from "@/components/plans/PostPreviewGrid";

export const dynamic = 'force-dynamic';

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;

  const session = await auth();
  if (!session?.user) redirect("/login");
  const orgId   = parseInt((session.user as any).organizationId);
  const isAdmin = (session.user as any).role === "superadmin";

  const plan = await prisma.monthlyPlan.findUnique({
    where: { id: parseInt(resolvedParams.id) },
    include: {
      brand: true,
      posts: {
        orderBy: { scheduledAt: 'asc' }
      }
    },
  });

  if (!plan) return notFound();
  // Cross-tenant IDOR koruması: başka org'un planı görüntülenemez
  if (!isAdmin && plan.brand.organizationId !== orgId) return notFound();

  const monthName = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"][plan.month - 1];

  // Ajan Logları — Plan seviyesi + bu plandaki tüm Post'ların logları (tam üretim hattı görünürlüğü)
  const logs = await prisma.agentLog.findMany({
    where: {
      OR: [
        { targetType: "Plan", targetId: plan.id },
        { targetType: "Post", targetId: { in: plan.posts.map((p) => p.id) } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });

  const logEntries: AgentLogEntry[] = logs.map((l) => ({
    id: l.id,
    agentName: l.agentName,
    action: l.action,
    status: (["SUCCESS", "FAILED", "NEEDS_HUMAN", "INFO"].includes(l.status) ? l.status : "INFO") as AgentLogEntry["status"],
    details: l.details,
    targetType: l.targetType,
    targetId: l.targetId,
    createdAt: l.createdAt.toISOString(),
  }));

  const postPreviews: PostPreviewData[] = plan.posts.map((p) => ({
    id: p.id,
    brandName: plan.brand.name,
    topic: p.topic,
    hook: p.hook,
    caption: p.caption,
    hashtags: p.hashtags,
    imagePath: p.imagePath,
    storyImagePath: p.storyImagePath,
    status: p.status,
    qualityScore: p.qualityScore,
  }));

  // Server Component'ten Client Component'e fonksiyon geçirilemez (RSC sınırı) —
  // aksiyon butonları burada JSX olarak önceden render edilip post id'sine göre haritalanır.
  const actionsByPostId: Record<number, React.ReactNode> = {};
  for (const p of plan.posts) {
    if (p.status === "client_review" || p.status === "reviewed" || p.status === "approved") {
      actionsByPostId[p.id] = <PostActions postId={p.id} status={p.status} />;
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Üst Kısım */}
      <BentoCard interactive={false} glow="0 210 255" className="p-5">
        <div className="flex items-center gap-4">
          <Link href="/plans" className="p-2 hover:bg-white/[0.06] rounded-md transition-colors text-muted-foreground">
            <ArrowLeft size={20} />
          </Link>
          <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center text-accent font-bold">
            <CalendarDays size={24} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-3 text-white">
              {plan.brand.name} — {monthName} {plan.year} İçerik Takvimi
              <span className="text-xs bg-white/[0.06] text-white px-2 py-1 rounded-full font-medium">
                {plan.status === "ideation_ready" ? "Fikirler Hazır" : plan.status}
              </span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Bu ay için toplam {plan.posts.length} gönderi planlandı.
            </p>
          </div>
          <div className="flex gap-2">
            {plan.status === "ready" && (
              <a
                href={`/api/plans/${plan.id}/report`}
                target="_blank"
                download
                className="bg-white/[0.04] border border-primary/30 text-primary hover:bg-primary/10 px-4 py-2 rounded-md font-medium transition-all flex items-center gap-2"
              >
                <Download size={18} />
                PDF İndir
              </a>
            )}
            <ClientLinkButton planId={plan.id} />
            <PlanActionButtons
              planId={plan.id}
              status={plan.status}
              hasPosts={plan.posts.length > 0}
            />
            <DeletePlanButton planId={plan.id} />
          </div>
        </div>
      </BentoCard>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Sol Ana Kısım: Post & Medya Önizleme */}
        <div className="lg:col-span-3">
          {plan.posts.length === 0 ? (
            <BentoCard interactive={false} className="p-12 text-center flex flex-col items-center">
              <BrainCircuit size={48} className="text-muted-foreground mb-4 opacity-50 animate-pulse" />
              <h3 className="text-lg font-medium text-white mb-2">Fikir Üretici Çalışıyor...</h3>
              <p className="text-muted-foreground max-w-sm">
                Ideation Specialist (AI) bu ayın hedefleri için stratejiye uygun en yaratıcı 12 post fikrini şu an üretiyor. Lütfen sayfayı birazdan yenileyin.
              </p>
            </BentoCard>
          ) : (
            <PostPreviewGrid posts={postPreviews} actionsByPostId={actionsByPostId} />
          )}
        </div>

        {/* Sağ Sütun: Brief & Ajan Zaman Çizelgesi */}
        <div className="space-y-6">

          <BentoCard interactive={false} className="p-5">
            <h3 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">Müşteri Notu</h3>
            <p className="text-sm text-muted-foreground italic bg-white/[0.02] p-3 rounded border border-white/[0.06]">
              "{plan.clientBrief || "Özel bir not girilmemiş. Genel marka stratejisine sadık kalınacak."}"
            </p>
          </BentoCard>

          <BentoCard interactive={false} glow="108 92 231" className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-white">
                <Activity size={16} className="text-primary" />
                Ajan Zaman Çizelgesi
              </h3>
              <span className="rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                Canlı
              </span>
            </div>
            <AgentTimeline logs={logEntries} />
          </BentoCard>

        </div>
      </div>
    </div>
  );
}
