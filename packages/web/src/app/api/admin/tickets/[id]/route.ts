import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as any)?.role !== "superadmin") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const { id } = await params;
  const { status } = await req.json();
  const allowed = ["open", "in_progress", "resolved", "closed"];
  if (!allowed.includes(status)) return NextResponse.json({ error: "Geçersiz durum" }, { status: 400 });

  const ticket = await prisma.supportTicket.update({
    where: { id: parseInt(id) },
    data: { status },
  });
  return NextResponse.json(ticket);
}
