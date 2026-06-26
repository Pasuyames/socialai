import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { Orchestrator } from "@/lib/agents/Orchestrator";
import { auth } from "@/lib/auth";
import { checkLimit } from "@/lib/subscription";
import { logBgError } from "@/lib/bgError";

export async function POST(req: Request) {
  try {
    const session = await auth();
    const orgId   = session?.user ? parseInt((session.user as any).organizationId) : null;
    const orgPlan = (session?.user as any)?.organizationPlan ?? "starter";

    const body = await req.json();
    const { brandId, month, year, clientBrief } = body;

    if (!brandId || !month || !year) {
      return NextResponse.json({ error: "Eksik bilgi." }, { status: 400 });
    }

    // Subscription limit: aylık plan sayısı
    if (orgId) {
      const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endOfMonth   = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
      const currentCount = await prisma.monthlyPlan.count({
        where: {
          brand: { organizationId: orgId },
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
      });
      const check = checkLimit(orgPlan, "maxPlansPerMonth", currentCount);
      if (!check.allowed) {
        return NextResponse.json({ error: check.message }, { status: 403 });
      }
    }

    const newPlan = await prisma.monthlyPlan.create({
      data: {
        brandId: parseInt(brandId),
        month:   parseInt(month),
        year:    parseInt(year),
        clientBrief,
        status:  "planning",
      },
    });

    await prisma.agentLog.create({
      data: {
        agentName:  "Project Manager",
        action:     `${month}/${year} dönemi için plan oluşturuldu. Ajan ekibi devreye alınıyor.`,
        targetType: "Plan",
        targetId:   newPlan.id,
      },
    });

    Orchestrator.startMonthlyPlan(newPlan.id).catch(logBgError("Aylık plan", "Plan", newPlan.id));

    return NextResponse.json(newPlan, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: "Plan oluşturulamadı." }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await auth();
    const orgId   = session?.user ? parseInt((session.user as any).organizationId) : null;

    const plans = await prisma.monthlyPlan.findMany({
      where: orgId ? { brand: { organizationId: orgId } } : {},
      include: { brand: true, posts: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(plans);
  } catch (error) {
    return NextResponse.json({ error: "Planlar getirilemedi." }, { status: 500 });
  }
}
