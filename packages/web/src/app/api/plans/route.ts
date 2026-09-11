import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { Orchestrator } from "@/lib/agents/Orchestrator";
import { authorize, authorizeBrand } from "@/lib/authz";
import { checkLimit } from "@/lib/subscription";
import { logBgError } from "@/lib/bgError";

// Girdi doğrulama — brandId/ay/yıl tip ve aralık kontrolü. Eskiden ham `body`
// doğrudan parseInt'e giriyordu: var olmayan bir brandId FK hatasına düşüp
// istemciye 500 döndürüyordu (bilgi sızdıran, yanlış statü).
const PlanSchema = z.object({
  brandId:     z.coerce.number({ error: "Marka seçilmedi." }).int().positive("Geçersiz marka ID."),
  month:       z.coerce.number({ error: "Ay bilgisi eksik." }).int().min(1, "Ay 1-12 arasında olmalı.").max(12, "Ay 1-12 arasında olmalı."),
  year:        z.coerce.number({ error: "Yıl bilgisi eksik." }).int().min(2020, "Geçersiz yıl.").max(2100, "Geçersiz yıl."),
  clientBrief: z.string().trim().max(5000, "Müşteri notu en fazla 5000 karakter olabilir.").optional(),
});

export async function POST(req: Request) {
  try {
    const parsed = PlanSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Eksik veya geçersiz bilgi." },
        { status: 400 },
      );
    }
    const { brandId, month, year, clientBrief } = parsed.data;

    // ─── ÇAPRAZ-KİRACI KORUMASI (KRİTİK) ────────────────────────────────────
    // Eskiden burada HİÇBİR sahiplik kontrolü yoktu: oturum açmış herhangi bir
    // kullanıcı, BAŞKA bir organizasyonun markası üzerine plan açabiliyordu
    // (doğrulandı: org 6 kullanıcısı org 2'nin markasına 201 ile plan açtı).
    // Sonuç: kurbanın AI bütçesini harcatma + panelini kirletme.
    // Ayrıca eski kod oturum yoksa orgId'yi null bırakıp kota kontrolünü
    // tamamen ATLIYORDU (fail-open). authorizeBrand her ikisini de kapatır.
    const az = await authorizeBrand(brandId);
    if (!az.ok) return az.error;

    // ─── Abonelik kotası: aylık plan sayısı ─────────────────────────────────
    // Kota, isteği YAPANIN değil markanın SAHİBİ organizasyonun aboneliğine
    // bakar — superadmin başka bir org adına plan açtığında da o org'un kotası
    // uygulanmalı. Plan bilgisi JWT'den DEĞİL DB'den okunur: auth.ts jwt
    // callback organizationPlan'ı sadece ilk girişte yazıyor, sonra
    // yenilemiyor → plan düşürüldükten sonra token BAYAT kalıyor.
    const brand = await prisma.brand.findUnique({
      where:  { id: brandId },
      select: { organizationId: true, organization: { select: { plan: true } } },
    });
    if (!brand) return NextResponse.json({ error: "Marka bulunamadı." }, { status: 404 });

    // Yetim marka (organizasyonsuz) → fail-closed: en kısıtlı plan varsayılır.
    const orgPlan = brand.organization?.plan ?? "starter";

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth   = new Date(year, month, 0, 23, 59, 59);
    const currentCount = await prisma.monthlyPlan.count({
      where: {
        brand: brand.organizationId
          ? { organizationId: brand.organizationId }
          : { id: brandId },
        createdAt: { gte: startOfMonth, lte: endOfMonth },
      },
    });
    const check = checkLimit(orgPlan, "maxPlansPerMonth", currentCount);
    if (!check.allowed) {
      return NextResponse.json({ error: check.message }, { status: 403 });
    }

    const newPlan = await prisma.monthlyPlan.create({
      data: { brandId, month, year, clientBrief, status: "planning" },
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
  } catch {
    return NextResponse.json({ error: "Plan oluşturulamadı." }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Eskiden oturum yoksa orgId null kalıyor ve `where: {}` ile TÜM
    // organizasyonların planları dönüyordu (fail-open). Artık oturum zorunlu;
    // superadmin dışındaki kullanıcı yalnızca kendi org'unun planlarını görür.
    const az = await authorize();
    if (!az.ok) return az.error;

    const plans = await prisma.monthlyPlan.findMany({
      where: az.isAdmin ? {} : { brand: { organizationId: az.orgId } },
      include: { brand: true, posts: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(plans);
  } catch {
    return NextResponse.json({ error: "Planlar getirilemedi." }, { status: 500 });
  }
}
