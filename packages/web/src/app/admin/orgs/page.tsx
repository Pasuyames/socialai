import prisma from "@/lib/db";
import Link from "next/link";
import { PLAN_LIMITS } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export default async function AdminOrgsPage() {
  const orgs = await prisma.organization.findMany({
    include: {
      users:  { select: { email: true, role: true, createdAt: true } },
      brands: { select: { id: true } },
      _count: { select: { brands: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const planBadge: Record<string, string> = {
    starter: "bg-zinc-700 text-zinc-300",
    pro:     "bg-blue-500/20 text-blue-400",
    agency:  "bg-purple-500/20 text-purple-400",
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Organizasyonlar</h1>
          <p className="text-sm text-muted-foreground">{orgs.length} kayıtlı organizasyon</p>
        </div>
      </div>

      <div className="bg-[#0E0E1A] border border-[#1E1E2E] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1E1E2E] text-xs text-muted-foreground uppercase tracking-wider">
              <th className="text-left px-6 py-3">Organizasyon</th>
              <th className="text-left px-6 py-3">Plan</th>
              <th className="text-left px-6 py-3">Markalar</th>
              <th className="text-left px-6 py-3">Kullanıcılar</th>
              <th className="text-left px-6 py-3">Owner</th>
              <th className="text-left px-6 py-3">Kayıt</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => {
              const limit = PLAN_LIMITS[org.plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.starter;
              const owner = org.users.find((u) => u.role === "owner");
              return (
                <tr key={org.id} className="border-b border-[#1E1E2E] last:border-0 hover:bg-[#1A1A2E]/50 transition-colors">
                  <td className="px-6 py-3">
                    <p className="font-medium text-white">{org.name}</p>
                    <p className="text-xs text-muted-foreground">{org.slug}</p>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${planBadge[org.plan] ?? planBadge.starter}`}>
                      {org.plan}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {org._count.brands} / {limit.maxBrands === 999 ? "∞" : limit.maxBrands}
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">{org.users.length}</td>
                  <td className="px-6 py-3 text-muted-foreground text-xs">{owner?.email ?? "—"}</td>
                  <td className="px-6 py-3 text-muted-foreground text-xs">
                    {new Date(org.createdAt).toLocaleDateString("tr-TR")}
                  </td>
                  <td className="px-6 py-3">
                    <Link href={`/admin/orgs/${org.id}`}
                      className="text-xs bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1 rounded-lg transition-colors">
                      Yönet
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
