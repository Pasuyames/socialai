import prisma from "@/lib/db";
import { Building2, Users, CalendarDays, FileText, LifeBuoy, TrendingUp } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [orgCount, userCount, brandCount, planCount, postCount, openTickets, recentOrgs] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.brand.count(),
    prisma.monthlyPlan.count(),
    prisma.post.count(),
    prisma.supportTicket.count({ where: { status: { in: ["open", "in_progress"] } } }),
    prisma.organization.findMany({
      include: { users: { take: 1 }, _count: { select: { brands: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const stats = [
    { label: "Toplam Org",    value: orgCount,     icon: Building2,    color: "text-primary",   bg: "bg-primary/10" },
    { label: "Kullanıcılar",  value: userCount,    icon: Users,        color: "text-accent",    bg: "bg-accent/10"  },
    { label: "Markalar",      value: brandCount,   icon: TrendingUp,   color: "text-secondary", bg: "bg-secondary/10" },
    { label: "Planlar",       value: planCount,    icon: CalendarDays, color: "text-success",   bg: "bg-success/10" },
    { label: "Gönderiler",    value: postCount,    icon: FileText,     color: "text-warning",   bg: "bg-warning/10" },
    { label: "Açık Biletler", value: openTickets,  icon: LifeBuoy,     color: "text-red-400",   bg: "bg-red-500/10" },
  ];

  const planBadge: Record<string, string> = {
    starter: "bg-zinc-700 text-zinc-300",
    pro:     "bg-blue-500/20 text-blue-400",
    agency:  "bg-purple-500/20 text-purple-400",
  };

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Genel Bakış</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Tüm platform istatistikleri</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-[#0E0E1A] border border-[#1E1E2E] rounded-xl p-4">
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-3`}>
              <Icon size={16} className={color} />
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-[#0E0E1A] border border-[#1E1E2E] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1E1E2E] flex items-center justify-between">
          <h2 className="font-semibold text-white">Son Kayıtlar</h2>
          <Link href="/admin/orgs" className="text-xs text-primary hover:underline">Tümünü gör →</Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1E1E2E] text-xs text-muted-foreground uppercase tracking-wider">
              <th className="text-left px-6 py-3">Organizasyon</th>
              <th className="text-left px-6 py-3">Plan</th>
              <th className="text-left px-6 py-3">Markalar</th>
              <th className="text-left px-6 py-3">Owner</th>
              <th className="text-left px-6 py-3">Tarih</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {recentOrgs.map((org) => (
              <tr key={org.id} className="border-b border-[#1E1E2E] hover:bg-[#1A1A2E]/50 transition-colors">
                <td className="px-6 py-3 font-medium text-white">{org.name}</td>
                <td className="px-6 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${planBadge[org.plan] ?? planBadge.starter}`}>
                    {org.plan}
                  </span>
                </td>
                <td className="px-6 py-3 text-muted-foreground">{org._count.brands}</td>
                <td className="px-6 py-3 text-muted-foreground">{org.users[0]?.email ?? "—"}</td>
                <td className="px-6 py-3 text-muted-foreground">
                  {new Date(org.createdAt).toLocaleDateString("tr-TR")}
                </td>
                <td className="px-6 py-3">
                  <Link href={`/admin/orgs/${org.id}`} className="text-xs text-primary hover:underline">Detay</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
