import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { Orchestrator } from "@/lib/agents/Orchestrator";
import { auth } from "@/lib/auth";
import { checkLimit } from "@/lib/subscription";
import { logBgError } from "@/lib/bgError";

const BrandSchema = z.object({
  name:            z.string().trim().min(1, "Marka adı zorunludur.").max(120),
  websiteUrl:      z.string().trim().url("Geçerli bir web sitesi URL'si girin.").max(2048).optional().or(z.literal("")),
  instagramHandle: z.string().trim().max(60).optional(),
  industry:        z.string().trim().max(40).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
    }
    const orgId   = parseInt((session.user as any).organizationId);
    const orgPlan = (session.user as any)?.organizationPlan ?? "starter";

    // Geçerli organizasyon zorunlu — org'suz marka yaratılmasını engelle
    if (isNaN(orgId)) {
      return NextResponse.json({ error: "Geçerli bir organizasyon bulunamadı." }, { status: 403 });
    }

    // Subscription limit kontrolü
    const currentCount = await prisma.brand.count({ where: { organizationId: orgId } });
    const check = checkLimit(orgPlan, "maxBrands", currentCount);
    if (!check.allowed) {
      return NextResponse.json({ error: check.message }, { status: 403 });
    }

    const parsed = BrandSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz giriş." }, { status: 400 });
    }
    const { name, websiteUrl, instagramHandle, industry } = parsed.data;

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now();

    const newBrand = await prisma.brand.create({
      data: {
        name,
        slug,
        websiteUrl,
        instagramHandle,
        industry: industry ?? "general",
        organizationId: orgId,
      },
    });

    await prisma.agentLog.create({
      data: {
        agentName: "Project Manager (Yönetici)",
        action:    "Yeni marka eklendi. İş paketleri oluşturuluyor.",
        targetType: "Brand",
        targetId:  newBrand.id,
      },
    });

    Orchestrator.startBrandOnboarding(newBrand.id, websiteUrl || "").catch(logBgError("Marka onboarding", "Brand", newBrand.id));

    return NextResponse.json(newBrand, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: "Marka oluşturulurken bir hata oluştu." }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
    }
    const orgId   = parseInt((session.user as any).organizationId);
    const isAdmin = (session.user as any).role === "superadmin";

    // Org'suz kullanıcı (superadmin hariç) hiçbir marka görmemeli
    if (isNaN(orgId) && !isAdmin) {
      return NextResponse.json([]);
    }

    const brands = await prisma.brand.findMany({
      where: isAdmin ? {} : { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(brands);
  } catch (error) {
    return NextResponse.json({ error: "Markalar getirilemedi." }, { status: 500 });
  }
}
