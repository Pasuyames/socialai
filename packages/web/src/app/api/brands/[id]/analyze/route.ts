import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { Orchestrator } from "@/lib/agents/Orchestrator";
import { authorizeBrand } from "@/lib/authz";
import { rateLimitOrError } from "@/lib/rateLimit";
import { logBgError } from "@/lib/bgError";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const brandId = parseInt(id);

    const az = await authorizeBrand(brandId);
    if (!az.ok) return az.error;

    const limited = rateLimitOrError(`ai:${az.orgId}`, 30, 600_000);
    if (limited) return limited;

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { websiteUrl: true },
    });

    if (!brand) {
      return NextResponse.json({ error: "Marka bulunamadı." }, { status: 404 });
    }

    // Tam onboarding zincirini (yeniden) başlat
    Orchestrator.startBrandOnboarding(brandId, brand.websiteUrl ?? "").catch(logBgError("Marka analizi", "Brand", brandId));

    return NextResponse.json({ message: "Ajan uyandırıldı, analiz arka planda başlatıldı." });
  } catch {
    return NextResponse.json({ error: "Analiz başlatılamadı." }, { status: 500 });
  }
}
