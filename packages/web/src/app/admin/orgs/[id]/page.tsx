import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { PLAN_LIMITS } from "@/lib/subscription";
import AdminPlanSelector from "./AdminPlanSelector";
import Link from "next/link";
import { ArrowLeft, Building2, Users, CalendarDays, FileText, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminOrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await prisma.organization.findUnique({
    where: { id: parseInt(id) },
    include: {
      users: { orderBy: { createdAt: "asc" } },
      brands: {
        include: { plans: { include: { _count: { select: { posts: true } } }, orderBy: { createdAt: "desc" }, take: 3 } },
      },
    },
  });
  if (!org) return notFound();

  const totalPlans = await prisma.monthlyPlan.count({ where: { brand: { organizationId: org.id } } });
  const totalPosts = await prisma.post.count({ where: { plan: { brand: { organizationId: org.id } } } });
  const recentLogs = await prisma.agentLog.findMany({
    where: { OR: org.brands.map((b) => ({ targetId: b.id, targetType: "Brand" })) },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  const limit = PLAN_LIMITS[org.plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.starter;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/orgs" className="p-2 hover:bg-[#1A1A2E] rounded-lg text-muted-foreground">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">{org.name}</h1>
          <p className="text-xs text-muted-foreground">{org.slug} · {new Date(org.createdAt).toLocaleDateString("tr-TR")} kayıt</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Markalar",   value: `${org.brands.length} / ${limit.maxBrands === 999 ? "∞" : limit.maxBrands}`, icon: Building2 },
          { label: "Kullanıcı",  value: org.users.length, icon: Users },
          { label: "Planlar",    value: totalPlans,        icon: CalendarDays },
          { label: "Gönderiler", value: totalPosts,        icon: FileText },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-[#0E0E1A] border border-[#1E1E2E] rounded-xl p-4">
            <Icon size={16} className="text-muted-foreground mb-2" />
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Plan Yönetimi */}
        <div className="bg-[#0E0E1A] border border-[#1E1E2E] rounded-xl p-5">
          <h2 className="font-semibold text-white mb-4">Plan Yönetimi</h2>
          <AdminPlanSelector orgId={org.id} currentPlan={org.plan} />
        </div>

        {/* Kullanıcılar */}
        <div className="bg-[#0E0E1A] border border-[#1E1E2E] rounded-xl p-5">
          <h2 className="font-semibold text-white mb-4">Kullanıcılar ({org.users.length})</h2>
          <div className="space-y-2">
            {org.users.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-2 border-b border-[#1E1E2E] last:border-0">
                <div>
                  <p className="text-sm text-white">{u.name ?? u.email}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === "owner" ? "bg-primary/20 text-primary" : "bg-zinc-700 text-zinc-300"}`}>
                  {u.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Markalar */}
      <div className="bg-[#0E0E1A] border border-[#1E1E2E] rounded-xl p-5">
        <h2 className="font-semibold text-white mb-4">Markalar ({org.brands.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {org.brands.map((brand) => (
            <div key={brand.id} className="border border-[#1E1E2E] rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-white">{brand.name}</p>
                <span className="text-xs text-muted-foreground capitalize">{brand.industry}</span>
              </div>
              <p className="text-xs text-muted-foreground">{brand.websiteUrl || "Web sitesi yok"}</p>
              <p className="text-xs text-muted-foreground mt-1">{brand.plans.length} plan · {brand.plans.reduce((s, p) => s + p._count.posts, 0)} gönderi</p>
            </div>
          ))}
          {org.brands.length === 0 && <p className="text-sm text-muted-foreground col-span-2">Henüz marka eklenmemiş.</p>}
        </div>
      </div>

      {/* Son Loglar */}
      {recentLogs.length > 0 && (
        <div className="bg-[#0E0E1A] border border-[#1E1E2E] rounded-xl p-5">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Activity size={16} className="text-primary" /> Son Ajan Aktiviteleri
          </h2>
          <div className="space-y-2">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex gap-3 text-xs py-2 border-b border-[#1E1E2E] last:border-0">
                <span className="text-accent font-medium shrink-0 w-36 truncate">{log.agentName}</span>
                <span className="text-muted-foreground flex-1 truncate">{log.action}</span>
                <span className="text-muted-foreground/60 shrink-0">{new Date(log.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
