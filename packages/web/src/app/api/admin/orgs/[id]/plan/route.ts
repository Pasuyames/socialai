import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as any)?.role !== "superadmin") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const { id } = await params;
  const { plan } = await req.json();

  const allowed = ["starter", "pro", "agency"];
  if (!allowed.includes(plan)) {
    return NextResponse.json({ error: "Geçersiz plan" }, { status: 400 });
  }

  const org = await prisma.organization.update({
    where: { id: parseInt(id) },
    data: { plan },
  });

  return NextResponse.json({ success: true, org });
}
