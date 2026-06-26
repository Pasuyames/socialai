import { NextResponse } from "next/server";
import fs from "fs";
import prisma from "@/lib/db";
import { authorizePlan } from "@/lib/authz";
import { resolveReportFile } from "@/lib/reports";

// GET /api/plans/[id]/report
// Plan raporunu YALNIZCA yetkili org kullanıcısına stream eder.
// (Raporlar artık public/ altında değil — auth'suz erişim mümkün değil.)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const planId = parseInt(id);

  const az = await authorizePlan(planId);
  if (!az.ok) return az.error;

  const plan = await prisma.monthlyPlan.findUnique({
    where: { id: planId },
    select: { reportPath: true },
  });
  if (!plan?.reportPath) {
    return NextResponse.json({ error: "Rapor henüz oluşturulmadı." }, { status: 404 });
  }

  const file = resolveReportFile(plan.reportPath);
  if (!file) {
    return NextResponse.json({ error: "Rapor dosyası bulunamadı." }, { status: 404 });
  }

  const buf = await fs.promises.readFile(file);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${file.split(/[\\/]/).pop()}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
