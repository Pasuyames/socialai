import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const orgId  = parseInt((session.user as any).organizationId);
  const userId = parseInt((session.user as any).id);

  const tickets = await prisma.supportTicket.findMany({
    where: { organizationId: orgId },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(tickets);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  const orgId  = parseInt((session.user as any).organizationId);
  const userId = parseInt((session.user as any).id);

  const { subject, category, priority, body } = await req.json();
  if (!subject || !body) return NextResponse.json({ error: "Konu ve mesaj zorunludur." }, { status: 400 });

  const ticket = await prisma.supportTicket.create({
    data: {
      organizationId: orgId,
      userId,
      subject,
      category: category ?? "general",
      priority: priority ?? "normal",
      status:   "open",
      messages: { create: { authorId: userId, isAdmin: false, body } },
    },
    include: { messages: true },
  });

  return NextResponse.json(ticket, { status: 201 });
}
