import prisma from "@/lib/db";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";

export const dynamic = "force-dynamic";

const statusStyle: Record<string, string> = {
  open:        "bg-red-500/15 text-red-400",
  in_progress: "bg-yellow-500/15 text-yellow-400",
  resolved:    "bg-green-500/15 text-green-400",
  closed:      "bg-zinc-700 text-zinc-400",
};

const statusLabel: Record<string, string> = {
  open: "Açık", in_progress: "İşlemde", resolved: "Çözüldü", closed: "Kapalı",
};

const priorityStyle: Record<string, string> = {
  low: "text-zinc-400", normal: "text-blue-400", high: "text-orange-400", urgent: "text-red-400",
};

export default async function AdminTicketsPage() {
  const tickets = await prisma.supportTicket.findMany({
    include: {
      organization: { select: { name: true } },
      user:         { select: { email: true, name: true } },
      messages:     { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  const open       = tickets.filter((t) => t.status === "open").length;
  const inProgress = tickets.filter((t) => t.status === "in_progress").length;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <LifeBuoy size={22} className="text-primary" /> Destek Biletleri
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {open} açık · {inProgress} işlemde · {tickets.length} toplam
          </p>
        </div>
      </div>

      <div className="bg-[#0E0E1A] border border-[#1E1E2E] rounded-xl overflow-hidden">
        {tickets.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Henüz destek bileti yok.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1E1E2E] text-xs text-muted-foreground uppercase tracking-wider">
                <th className="text-left px-6 py-3">Bilet</th>
                <th className="text-left px-6 py-3">Organizasyon</th>
                <th className="text-left px-6 py-3">Durum</th>
                <th className="text-left px-6 py-3">Öncelik</th>
                <th className="text-left px-6 py-3">Tarih</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-b border-[#1E1E2E] last:border-0 hover:bg-[#1A1A2E]/40 transition-colors">
                  <td className="px-6 py-3">
                    <p className="font-medium text-white">{t.subject}</p>
                    <p className="text-xs text-muted-foreground">{t.user.name ?? t.user.email} · {t.category}</p>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground text-xs">{t.organization.name}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusStyle[t.status]}`}>
                      {statusLabel[t.status]}
                    </span>
                  </td>
                  <td className={`px-6 py-3 text-xs font-medium capitalize ${priorityStyle[t.priority]}`}>{t.priority}</td>
                  <td className="px-6 py-3 text-xs text-muted-foreground">
                    {new Date(t.updatedAt).toLocaleDateString("tr-TR")}
                  </td>
                  <td className="px-6 py-3">
                    <Link href={`/admin/tickets/${t.id}`}
                      className="text-xs bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1 rounded-lg transition-colors">
                      Yanıtla
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
