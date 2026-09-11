import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authorizeAdmin } from "@/lib/authz";

const ALLOWED = ["open", "in_progress", "resolved", "closed"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const az = await authorizeAdmin();
    if (!az.ok) return az.error;

    const { id } = await params;
    const ticketId = parseInt(id);
    if (!Number.isInteger(ticketId)) {
      return NextResponse.json({ error: "Geçersiz bilet ID." }, { status: 400 });
    }

    // `await req.json()` bozuk gövdede FIRLATIYORDU → route 500 ile çöküyordu.
    const body = await req.json().catch(() => null);
    const status = (body as { status?: unknown } | null)?.status;
    if (typeof status !== "string" || !ALLOWED.includes(status)) {
      return NextResponse.json({ error: "Geçersiz durum" }, { status: 400 });
    }

    // Olmayan bilette Prisma P2025 fırlatıyordu → 500. Artık 404.
    const exists = await prisma.supportTicket.findUnique({ where: { id: ticketId }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: "Bilet bulunamadı." }, { status: 404 });

    const ticket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data:  { status },
    });
    return NextResponse.json(ticket);
  } catch {
    return NextResponse.json({ error: "Bilet güncellenemedi." }, { status: 500 });
  }
}
