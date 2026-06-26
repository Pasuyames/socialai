import { NextResponse } from "next/server";
import fs from "fs";
import prisma from "@/lib/db";
import { resolveReportFile } from "@/lib/reports";

// GET /api/client/[token]/report
// Müşteri portalı raporu — erişim, tahmin edilemez UUID token (capability) ile
// yetkilendirilir. Token public path'tir (middleware PUBLIC_PATHS), doğrulama
// burada planın clientToken'ı ile birebir eşleşmeyle yapılır.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Geçersiz token." }, { status: 400 });
  }

  const plan = await prisma.monthlyPlan.findUnique({
    where: { clientToken: token },
    select: { reportPath: true },
  });
  if (!plan?.reportPath) {
    return NextResponse.json({ error: "Rapor bulunamadı." }, { status: 404 });
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
