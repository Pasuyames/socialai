import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, Activity, BrainCircuit, Palette, Download, Send, Edit3, Image, ShieldCheck, CheckCircle, AlertTriangle } from "lucide-react";
import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import PlanActionButtons from "./PlanActionButtons";
import DeletePlanButton from "./DeletePlanButton";
import PostActions from "./PostActions";
import ClientLinkButton from "./ClientLinkButton";

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

  // Ajan Logları
  const logs = await prisma.agentLog.findMany({
    where: { targetId: plan.id, targetType: "Plan" },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Üst Kısım */}
      <div className="flex items-center gap-4 border-b border-[#1E1E2E] pb-4">
        <Link href="/plans" className="p-2 hover:bg-[#1A1A2E] rounded-md transition-colors text-muted-foreground">
          <ArrowLeft size={20} />
        </Link>
        <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center text-accent font-bold">
          <CalendarDays size={24} />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            {plan.brand.name} — {monthName} {plan.year} İçerik Takvimi
            <span className="text-xs bg-[#1A1A2E] text-white px-2 py-1 rounded-full font-medium">
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
              className="bg-[#1A1A2E] border border-primary/30 text-primary hover:bg-primary/10 px-4 py-2 rounded-md font-medium transition-all flex items-center gap-2"
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Sol Ana Kısım: Post Kartları */}
        <div className="lg:col-span-3 space-y-4">
          {plan.posts.length === 0 ? (
            <div className="bg-[color:var(--card)] border border-[#1E1E2E] rounded-lg p-12 text-center flex flex-col items-center">
              <BrainCircuit size={48} className="text-muted-foreground mb-4 opacity-50 animate-pulse" />
              <h3 className="text-lg font-medium text-white mb-2">Fikir Üretici Çalışıyor...</h3>
              <p className="text-muted-foreground max-w-sm">
                Ideation Specialist (AI) bu ayın hedefleri için stratejiye uygun en yaratıcı 12 post fikrini şu an üretiyor. Lütfen sayfayı birazdan yenileyin.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plan.posts.map((post, idx) => (
                <div key={post.id} className="bg-[color:var(--card)] border border-[#1E1E2E] rounded-lg p-5 flex flex-col h-full">
                  
                  {/* Post Header */}
                  <div className="flex justify-between items-start mb-3 border-b border-[#1E1E2E] pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#1A1A2E] flex items-center justify-center text-xs font-bold text-muted-foreground">
                        {idx + 1}
                      </span>
                      <h4 className="font-semibold text-white">{post.topic}</h4>
                    </div>
                    <div className="text-xs font-medium text-accent bg-accent/10 px-2 py-1 rounded">
                      {post.scheduledAt ? new Date(post.scheduledAt).toLocaleDateString("tr-TR", { day: 'numeric', month: 'short' }) : "Tarihsiz"}
                    </div>
                  </div>

                  {/* Post Body (Caption Taslağı) */}
                  <div className="flex-1 mb-4 space-y-3">
                    {post.imagePath && (
                      <div className="flex gap-2 mb-3">
                        <div className="flex-1 h-48 overflow-hidden rounded-md border border-[#1A1A2E] relative">
                           <span className="absolute top-1 left-1 bg-black/50 text-[10px] px-1.5 py-0.5 rounded text-white z-10 font-bold tracking-wider shadow">POST (4:5)</span>
                           <img src={post.imagePath} alt="Post Content" className="w-full h-full object-cover" />
                        </div>
                        {post.storyImagePath && (
                           <div className="w-[100px] shrink-0 h-48 overflow-hidden rounded-md border border-[#1A1A2E] relative">
                             <span className="absolute top-1 left-1 bg-black/50 text-[10px] px-1.5 py-0.5 rounded text-white z-10 font-bold tracking-wider shadow">STORY (9:16)</span>
                             <img src={post.storyImagePath} alt="Story Content" className="w-full h-full object-cover" />
                           </div>
                        )}
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {post.caption}
                    </p>
                    {post.hashtags && (
                      <div className="text-xs font-medium text-accent flex flex-wrap gap-1">
                        {post.hashtags.split(' ').map((tag, i) => (
                           <span key={i} className="bg-accent/10 px-1.5 py-0.5 rounded">{tag}</span>
                        ))}
                      </div>
                    )}
                    {/* Görsel İlham Görselleri */}
                    {(post as any).inspirationUrls && (() => {
                      try {
                        const urls: string[] = JSON.parse((post as any).inspirationUrls);
                        return urls.length > 0 ? (
                          <div className="mt-2">
                            <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Görsel İlham</p>
                            <div className="flex gap-1.5 overflow-x-auto pb-1">
                              {urls.slice(0, 5).map((url, i) => (
                                <img key={i} src={url} alt="ilham" className="h-16 w-16 object-cover rounded-md shrink-0 border border-[#1A1A2E]" />
                              ))}
                            </div>
                          </div>
                        ) : null;
                      } catch { return null; }
                    })()}
                    {post.imagePrompt && (
                      <div className="mt-3 p-3 bg-[#0A0A0F] border border-[#1A1A2E] rounded text-xs font-mono text-muted-foreground">
                        <span className="flex items-center gap-1 text-white mb-1"><Palette size={12}/> Prompt Engineer:</span>
                        {post.imagePrompt}
                      </div>
                    )}
                  </div>

                  {/* Status + Aksiyon Butonları */}
                  <div className="pt-3 border-t border-[#1E1E2E] mt-auto flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-medium">
                      {post.status === "ideation"               && <><BrainCircuit size={13} className="text-secondary"/> <span className="text-secondary">Fikir Aşaması</span></>}
                      {post.status === "writing"                && <><Edit3 size={13} className="text-warning"/> <span className="text-warning">Metin Yazılıyor</span></>}
                      {post.status === "reviewed"               && <><ShieldCheck size={13} className="text-success"/> <span className="text-success">İncelendi</span></>}
                      {post.status === "ready_for_image"        && <><Palette size={13} className="text-accent"/> <span className="text-accent">Görsel Hazırlığı</span></>}
                      {post.status === "image_prompt_ready"     && <><Image size={13} className="text-accent"/> <span className="text-accent">Görsel Bekliyor</span></>}
                      {post.status === "qc_review"              && <><ShieldCheck size={13} className="text-warning"/> <span className="text-warning">QA İnceleme</span></>}
                      {post.status === "needs_rewrite"          && <><Edit3 size={13} className="text-warning"/> <span className="text-warning">Revizyon Bekliyor</span></>}
                      {post.status === "published"              && <><Send size={13} className="text-primary"/> <span className="text-primary">Yayında</span></>}
                      {post.status === "needs_human_intervention" && <><AlertTriangle size={13} className="text-danger"/> <span className="text-danger">Manuel Müdahale</span></>}
                    </span>
                    {(post.status === "client_review" || post.status === "reviewed" || post.status === "approved") && (
                      <PostActions postId={post.id} status={post.status} />
                    )}
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sağ Sütun: Sidebar (Brief & Logs) */}
        <div className="space-y-6">
          
          <div className="bg-[color:var(--card)] border border-[#1E1E2E] rounded-lg p-5">
            <h3 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider">Müşteri Notu</h3>
            <p className="text-sm text-muted-foreground italic bg-[#0A0A0F] p-3 rounded border border-[#1A1A2E]">
              "{plan.clientBrief || "Özel bir not girilmemiş. Genel marka stratejisine sadık kalınacak."}"
            </p>
          </div>

          <div className="bg-[color:var(--card)] border border-[#1E1E2E] rounded-lg p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-white">
              <Activity size={18} className="text-primary"/>
              Operasyon Logları
            </h3>
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="relative pl-4 border-l-2 border-[#1E1E2E] py-0.5">
                  <div className="absolute w-2 h-2 rounded-full bg-primary -left-[5px] top-2"></div>
                  <p className="text-[11px] font-semibold text-accent mb-0.5 uppercase tracking-wide">{log.agentName}</p>
                  <p className="text-xs text-white leading-tight">{log.action}</p>
                </div>
              ))}
              {logs.length === 0 && <p className="text-xs text-muted-foreground">Henüz log yok.</p>}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}