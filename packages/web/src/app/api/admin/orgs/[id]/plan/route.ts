import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authorizeAdmin } from "@/lib/authz";
import { PLAN_LIMITS } from "@/lib/subscription";

// Geçerli plan listesi tek kaynaktan gelir (lib/subscription.ts). Eskiden burada
// elle ["starter","pro","agency"] yazılıydı; yeni bir plan eklendiğinde bu liste
// sessizce geride kalır ve admin o planı atayamazdı.
const ALLOWED_PLANS = Object.keys(PLAN_LIMITS);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const az = await authorizeAdmin();
    if (!az.ok) return az.error;

    const { id } = await params;
    const orgId = parseInt(id);
    if (!Number.isInteger(orgId)) {
      return NextResponse.json({ error: "Geçersiz organizasyon ID." }, { status: 400 });
    }

    // `await req.json()` bozuk gövdede FIRLATIYORDU → route 500 ile çöküyordu.
    const body = await req.json().catch(() => null);
    const plan = (body as { plan?: unknown } | null)?.plan;
    if (typeof plan !== "string" || !ALLOWED_PLANS.includes(plan)) {
      return NextResponse.json(
        { error: `Geçersiz plan. Geçerli değerler: ${ALLOWED_PLANS.join(", ")}` },
        { status: 400 },
      );
    }

    // Olmayan org'da Prisma P2025 fırlatıyordu → 500. Artık 404.
    const exists = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: "Organizasyon bulunamadı." }, { status: 404 });

    const org = await prisma.organization.update({
      where: { id: orgId },
      data:  { plan },
    });

    return NextResponse.json({ success: true, org });
  } catch {
    return NextResponse.json({ error: "Plan güncellenemedi." }, { status: 500 });
  }
}
