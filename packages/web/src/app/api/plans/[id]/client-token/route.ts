import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { randomUUID } from "crypto";
import { authorizePlan } from "@/lib/authz";
import { hasFeature } from "@/lib/subscription";

// Plan için müşteri portalı token'ı oluştur veya mevcut olanı döndür
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const planId = parseInt(id);

  const az = await authorizePlan(planId);
  if (!az.ok) return az.error;

  // Plan + sahibi organizasyonun ABONELİK planı tek sorguda.
  //
  // Neden session'daki organizationPlan değil de DB'deki organization.plan?
  // auth.ts'teki jwt callback organizationPlan'ı SADECE ilk girişte (`if (user)`)
  // token'a yazıyor; sonradan yenilenmiyor. Superadmin /api/admin/orgs/[id]/plan
  // ile planı düşürse bile kullanıcının JWT'si yeniden giriş yapana kadar eski
  // (BAYAT) planı taşır. Para ile ilgili bir kapıda bayat veri = ücretsiz Pro
  // özelliği demektir → tek doğru kaynak DB.
  //
  // Ayrıca kontrol, isteği yapan kullanıcının değil, PLANIN SAHİBİ organizasyonun
  // aboneliğine bakar: superadmin başkası adına da olsa Starter bir organizasyona
  // portal açamaz (özellik yine bedavaya kullanılmış olurdu).
  const plan = await prisma.monthlyPlan.findUnique({
    where: { id: planId },
    select: {
      clientToken: true,
      brand: { select: { organization: { select: { plan: true } } } },
    },
  });
  if (!plan) return NextResponse.json({ error: "Plan bulunamadı." }, { status: 404 });

  // Abonelik kapısı: müşteri portalı Pro ve üzeri planlara özel.
  // Organizasyonu olmayan (yetim) marka → fail-closed: en kısıtlı plan varsayılır.
  const feature = hasFeature(plan.brand.organization?.plan ?? "starter", "clientPortal");
  if (!feature.allowed) {
    return NextResponse.json({ error: feature.message }, { status: 403 });
  }

  const token = plan.clientToken ?? randomUUID();

  await prisma.monthlyPlan.update({
    where: { id: planId },
    data: { clientToken: token },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return NextResponse.json({ token, url: `${baseUrl}/client/${token}` });
}
