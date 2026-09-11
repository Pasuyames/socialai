import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { authorize } from "@/lib/authz";
import { rateLimitOrError } from "@/lib/rateLimit";

// Mesaj gövdesi eskiden `body?.trim()` ile kontrol ediliyordu: gövde bir OBJE
// geldiğinde `body.trim` undefined olup çağrıldığı için TypeError fırlıyor ve
// route 500 ile çöküyordu (bozuk JSON'da da aynısı). Artık Zod doğruluyor.
const MessageSchema = z.object({
  body: z.string().trim().min(1, "Mesaj boş olamaz.").max(5000, "Mesaj en fazla 5000 karakter olabilir."),
});

// Bilete erişim: kendi org'u ya da superadmin. Tek yerde tutulur ki GET ve POST
// arasında kural farkı oluşmasın.
async function loadTicket(id: string) {
  const az = await authorize();
  if (!az.ok) return { ok: false as const, error: az.error };

  const ticketId = parseInt(id);
  if (!Number.isInteger(ticketId)) {
    return { ok: false as const, error: NextResponse.json({ error: "Geçersiz bilet ID." }, { status: 400 }) };
  }

  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    return { ok: false as const, error: NextResponse.json({ error: "Bulunamadı" }, { status: 404 }) };
  }
  if (!az.isAdmin && ticket.organizationId !== az.orgId) {
    return { ok: false as const, error: NextResponse.json({ error: "Yetkisiz" }, { status: 403 }) };
  }
  return { ok: true as const, ticket, ticketId, az };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await loadTicket(id);
  if (!r.ok) return r.error;

  const messages = await prisma.ticketMessage.findMany({
    where: { ticketId: r.ticketId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(messages);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const r = await loadTicket(id);
    if (!r.ok) return r.error;

    // Kapatılmış bilete yazılmaz — aksi halde çözülmüş bir konuşma sessizce
    // yeniden canlanır ve kimse bakmaz.
    if (r.ticket.status === "closed") {
      return NextResponse.json({ error: "Kapatılmış bilete mesaj eklenemez." }, { status: 409 });
    }

    const limited = rateLimitOrError(`ticketmsg:${r.ticketId}`, 60, 60 * 60 * 1000);
    if (limited) return limited;

    const parsed = MessageSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Geçersiz istek gövdesi." },
        { status: 400 },
      );
    }

    const isAdmin = r.az.isAdmin;
    const [message] = await prisma.$transaction([
      prisma.ticketMessage.create({
        data: { ticketId: r.ticketId, authorId: r.az.userId, isAdmin, body: parsed.data.body },
      }),
      prisma.supportTicket.update({
        where: { id: r.ticketId },
        data: { status: isAdmin ? "in_progress" : r.ticket.status, updatedAt: new Date() },
      }),
    ]);

    return NextResponse.json(message, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Mesaj eklenemedi." }, { status: 500 });
  }
}
