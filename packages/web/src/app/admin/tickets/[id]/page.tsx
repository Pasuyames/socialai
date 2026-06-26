import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import TicketConversation from "./TicketConversation";

export const dynamic = "force-dynamic";

const statusStyle: Record<string, string> = {
  open: "bg-red-500/15 text-red-400", in_progress: "bg-yellow-500/15 text-yellow-400",
  resolved: "bg-green-500/15 text-green-400", closed: "bg-zinc-700 text-zinc-400",
};
const statusLabel: Record<string, string> = {
  open: "Açık", in_progress: "İşlemde", resolved: "Çözüldü", closed: "Kapalı",
};

export default async function AdminTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: parseInt(id) },
    include: {
      organization: { select: { name: true, plan: true } },
      user:         { select: { name: true, email: true } },
      messages:     { orderBy: { createdAt: "asc" } },
    },
  });
  if (!ticket) return notFound();

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/tickets" className="p-2 hover:bg-[#1A1A2E] rounded-lg text-muted-foreground">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">{ticket.subject}</h1>
          <p className="text-xs text-muted-foreground">
            {ticket.organization.name} ({ticket.organization.plan}) · {ticket.user.name ?? ticket.user.email}
          </p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyle[ticket.status]}`}>
          {statusLabel[ticket.status]}
        </span>
      </div>

      <TicketConversation
        ticketId={ticket.id}
        messages={ticket.messages}
        currentStatus={ticket.status}
        isAdmin
      />
    </div>
  );
}
