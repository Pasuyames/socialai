import { NextResponse }  from "next/server";
import prisma           from "@/lib/db";
import { Orchestrator }  from "@/lib/agents/Orchestrator";
import { authorizePlan } from "@/lib/authz";
import { rateLimitOrError } from "@/lib/rateLimit";
import { checkLimit } from "@/lib/subscription";
import { logBgError } from "@/lib/bgError";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const planId  = parseInt(id);

    const az = await authorizePlan(planId);
    if (!az.ok) return az.error;

    const limited = rateLimitOrError(`ai:${az.orgId}`, 30, 600_000);
    if (limited) return limited;

    // ─── Abonelik kotası: plan başına gönderi (maxPostsPerPlan) ──────────────
    //
    // KAPSAM UYARISI — bu kontrol ÖN KOŞUL kapısıdır, üretim adedini kısmaz:
    // Post kayıtlarını yaratan TEK yer IdeationSpecialist.execute() ve adedi
    // directorBrief.postCountTarget'tan clamp(4, 24) ile KENDİSİ belirliyor.
    // API katmanı Orchestrator'ı arka planda tetikleyip hemen yanıt döndüğü için
    // o adedi ne görebiliyor ne de sınırlayabiliyor (ajan dosyaları bu iş
    // paketinde değiştirilmiyor). Burada engellenebilen şey şudur: plan ZATEN
    // kotası kadar gönderi taşıyorken fikir üretiminin tekrar çalıştırılması —
    // IdeationSpecialist mevcut postları silmediği için her tekrar çalıştırma
    // kotanın üstüne yenilerini EKLİYOR (sınırsız büyüme).
    // Plan bilgisi yine JWT'den değil DB'den okunur (token bayat kalabiliyor);
    // kontrol planın SAHİBİ organizasyonun aboneliğine bakar.
    const planRow = await prisma.monthlyPlan.findUnique({
      where:  { id: planId },
      select: {
        brand:  { select: { organization: { select: { plan: true } } } },
        _count: { select: { posts: true } },
      },
    });
    if (planRow) {
      // Yetim marka (organizasyonsuz) → fail-closed: en kısıtlı plan varsayılır.
      const orgPlan = planRow.brand.organization?.plan ?? "starter";
      const check = checkLimit(orgPlan, "maxPostsPerPlan", planRow._count.posts);
      if (!check.allowed) {
        return NextResponse.json({ error: check.message }, { status: 403 });
      }
    }

    // Arka planda çalıştır, API yanıtını bekletme
    Orchestrator.startMonthlyPlan(planId).catch(logBgError("Aylık plan", "Plan", planId));

    return NextResponse.json({ success: true, message: "Aylık plan süreci başlatıldı." });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
