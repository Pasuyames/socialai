import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { id } = await params;
  const ticketId = parseInt(id);
  const orgId    = parseInt((session.user as any).organizationId);
  const isAdmin  = (session.user as any).role === "superadmin";

  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  if (!isAdmin && ticket.organizationId !== orgId) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const messages = await prisma.ticketMessage.findMany({
    where: { ticketId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(messages);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { id } = await params;
  const ticketId = parseInt(id);
  const orgId    = parseInt((session.user as any).organizationId);
  const userId   = parseInt((session.user as any).id);
  const isAdmin  = (session.user as any).role === "superadmin";

  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  if (!isAdmin && ticket.organizationId !== orgId) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const { body } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: "Mesaj boş olamaz" }, { status: 400 });

  const [message] = await prisma.$transaction([
    prisma.ticketMessage.create({ data: { ticketId, authorId: userId, isAdmin, body } }),
    prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: isAdmin ? "in_progress" : ticket.status, updatedAt: new Date() },
    }),
  ]);

  return NextResponse.json(message, { status: 201 });
}
