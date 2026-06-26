import { Building2, CalendarDays, CheckCircle2, FileText, Activity, TrendingUp, Clock, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import prisma from "@/lib/db";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const statConfig = [
  {
    title: "Toplam Marka",
    icon: Building2,
    href: "/brands",
    gradient: "from-[#6C5CE7] to-[#a78bfa]",
    hoverShadow: "hover:shadow-[0_0_24px_rgba(108,92,231,0.3)]",
    bg: "bg-primary/10",
    iconColor: "text-primary",
  },
  {
    title: "Aktif Plan",
    icon: CalendarDays,
    href: "/plans",
    gradient: "from-[#00D2FF] to-[#0984e3]",
    hoverShadow: "hover:shadow-[0_0_24px_rgba(0,210,255,0.25)]",
    bg: "bg-accent/10",
    iconColor: "text-accent",
  },
  {
    title: "Toplam İçerik",
    icon: FileText,
    href: "/plans",
    gradient: "from-[#fd79a8] to-[#e84393]",
    hoverShadow: "hover:shadow-[0_0_24px_rgba(253,121,168,0.25)]",
    bg: "bg-pink-500/10",
    iconColor: "text-pink-400",
  },
  {
    title: "Onaylanan",
    icon: CheckCircle2,
    href: "/plans",
    gradient: "from-[#00E676] to-[#00b09b]",
    hoverShadow: "hover:shadow-[0_0_24px_rgba(0,230,118,0.25)]",
    bg: "bg-green-500/10",
    iconColor: "text-green-400",
  },
];

export default async function DashboardPage() {
  const session = await auth();
  const orgId   = session?.user ? parseInt((session.user as any).organizationId) : null;

  const brandWhere = orgId ? { organizationId: orgId } : {};
  const postWhere  = orgId ? { plan: { brand: { organizationId: orgId } } } : {};

  const [brandCount, planCount, postCount, approvedCount, recentLogs, upcomingPosts] = await Promise.all([
    prisma.brand.count({ where: brandWhere }),
    prisma.monthlyPlan.count({ where: orgId ? { brand: { organizationId: orgId } } : {} }),
    prisma.post.count({ where: postWhere }),
    prisma.post.count({ where: { ...postWhere, status: { in: ["client_review", "approved", "published"] } } }),
    prisma.agentLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.post.findMany({
      where: { ...postWhere, scheduledAt: { not: null } },
      include: { plan: { include: { brand: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
  ]);

  const statValues = [brandCount, planCount, postCount, approvedCount];

  return (
    <div className="space-y-7 max-w-7xl mx-auto animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Ajans Özeti</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Tüm markalar ve içeriklerinize genel bakış</p>
        </div>
        <Link href="/brands/new">
          <Button size="sm">+ Yeni Marka</Button>
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statConfig.map(({ title, icon: Icon, href, gradient, hoverShadow, bg, iconColor }, i) => (
          <Link key={title} href={href}>
            <div className={`relative rounded-xl border border-[#1A1A2E] bg-[#0C0C16] p-5 cursor-pointer overflow-hidden group transition-all duration-200 hover:border-[#2A2A3E] ${hoverShadow}`}>

              {/* Gradient top line */}
              <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${gradient} opacity-60 group-hover:opacity-100 transition-opacity`} />

              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon size={18} className={iconColor} />
                </div>
                <ArrowUpRight size={14} className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
              </div>

              <p className="text-3xl font-bold text-white tabular-nums">{statValues[i]}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">{title}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Agent logs */}
        <div className="lg:col-span-3 rounded-xl border border-[#1A1A2E] bg-[#0C0C16] p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <div className="relative flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <div className="absolute w-2 h-2 rounded-full bg-green-400 animate-ping opacity-60" />
              </div>
              Ajan Aktiviteleri
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
              Canlı
            </span>
          </div>

          <div className="space-y-0.5">
            {recentLogs.length > 0 ? (
              recentLogs.map((log, idx) => (
                <div
                  key={log.id}
                  className="flex gap-3 items-start text-sm p-3 rounded-lg hover:bg-white/[0.03] transition-colors group"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Activity size={12} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-xs">{log.agentName}</p>
                    <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2 leading-relaxed">{log.action}</p>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 shrink-0 mt-0.5">
                    <Clock size={9} />
                    {new Date(log.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={<Activity size={24} />}
                title="Henüz aktivite yok"
                description="Ajan logları burada görünecek"
              />
            )}
          </div>
        </div>

        {/* Upcoming posts */}
        <div className="lg:col-span-2 rounded-xl border border-[#1A1A2E] bg-[#0C0C16] p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <CalendarDays size={14} className="text-accent" />
              Yaklaşan Gönderiler
            </h3>
          </div>

          <div className="space-y-2">
            {upcomingPosts.length > 0 ? (
              upcomingPosts.map((post) => (
                <div key={post.id}
                  className="flex gap-3 items-center p-3 rounded-xl bg-[#0A0A14] border border-[#1A1A2E] hover:border-[#2A2A3E] transition-colors">
                  {post.imagePath ? (
                    <img src={post.imagePath} alt="Post" className="w-10 h-10 rounded-lg object-cover shrink-0 border border-[#1A1A2E]" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-[#12121E] border border-[#1A1A2E] flex items-center justify-center shrink-0">
                      <FileText size={13} className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{post.plan.brand.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{post.topic}</p>
                    <StatusBadge status={post.status} />
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-accent tabular-nums">
                      {post.scheduledAt
                        ? new Date(post.scheduledAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })
                        : "—"}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={<CalendarDays size={24} />}
                title="Planlanmış gönderi yok"
                description="Plan oluşturduğunuzda burada görünür"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
