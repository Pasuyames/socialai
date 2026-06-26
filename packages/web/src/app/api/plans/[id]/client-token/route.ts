import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { randomUUID } from "crypto";
import { authorizePlan } from "@/lib/authz";

// Plan için müşteri portalı token'ı oluştur veya mevcut olanı döndür
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const planId = parseInt(id);

  const az = await authorizePlan(planId);
  if (!az.ok) return az.error;

  const plan = await prisma.monthlyPlan.findUnique({
    where: { id: planId },
    select: { clientToken: true },
  });
  if (!plan) return NextResponse.json({ error: "Plan bulunamadı." }, { status: 404 });

  const token = plan.clientToken ?? randomUUID();

  await prisma.monthlyPlan.update({
    where: { id: planId },
    data: { clientToken: token },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return NextResponse.json({ token, url: `${baseUrl}/client/${token}` });
}
