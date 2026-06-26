import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import Link from "next/link";
import NewTicketForm from "./NewTicketForm";
import { LifeBuoy, MessageSquare, Clock, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

const statusStyle: Record<string, string> = {
  open:        "bg-red-500/10 text-red-400 border border-red-500/20",
  in_progress: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  resolved:    "bg-green-500/10 text-green-400 border border-green-500/20",
  closed:      "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20",
};
const statusLabel: Record<string, string> = {
  open: "Açık", in_progress: "İşlemde", resolved: "Çözüldü", closed: "Kapalı",
};

export default async function SupportPage() {
  const session = await auth();
  const orgId   = parseInt((session?.user as any).organizationId);

  const tickets = await prisma.supportTicket.findMany({
    where: { organizationId: orgId },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <LifeBuoy size={20} className="text-primary" />
            Destek
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Sorularınız için bilet açın, ekibimiz yanıtlasın.</p>
        </div>
        {tickets.length > 0 && (
          <span className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
            {tickets.filter(t => t.status === "open").length} açık bilet
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Ticket list */}
        <div className="lg:col-span-3 space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Biletlerim ({tickets.length})
          </p>

          {tickets.length === 0 ? (
            <div className="rounded-xl border border-[#1A1A2E] bg-[#0C0C16] p-10 text-center">
              <MessageSquare size={28} className="text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Henüz bilet açmadınız.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Sağdaki formu kullanarak yeni bilet açabilirsiniz.</p>
            </div>
          ) : (
            tickets.map((t) => (
              <Link key={t.id} href={`/support/${t.id}`}
                className="flex items-start gap-4 p-4 rounded-xl border border-[#1A1A2E] bg-[#0C0C16] hover:border-primary/25 hover:shadow-[0_0_16px_rgba(108,92,231,0.08)] transition-all group">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <MessageSquare size={14} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white group-hover:text-primary transition-colors text-sm truncate">{t.subject}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {t.category} · {t.messages[0]?.body.slice(0, 55)}...
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusStyle[t.status]}`}>
                      {statusLabel[t.status]}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                      <Clock size={9} />
                      {new Date(t.updatedAt).toLocaleDateString("tr-TR")}
                    </span>
                  </div>
                </div>
                <ChevronRight size={14} className="text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0 mt-2" />
              </Link>
            ))
          )}
        </div>

        {/* New ticket form */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-[#1A1A2E] bg-[#0C0C16] p-5 sticky top-4">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <LifeBuoy size={13} className="text-primary" />
              </div>
              <h2 className="text-sm font-semibold text-white">Yeni Bilet Aç</h2>
            </div>
            <NewTicketForm />
          </div>
        </div>
      </div>
    </div>
  );
}
