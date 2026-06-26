import { NextResponse }  from "next/server";
import { Orchestrator }  from "@/lib/agents/Orchestrator";
import { authorizePlan } from "@/lib/authz";
import { rateLimitOrError } from "@/lib/rateLimit";
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

    // Arka planda çalıştır, API yanıtını bekletme
    Orchestrator.startMonthlyPlan(planId).catch(logBgError("Aylık plan", "Plan", planId));

    return NextResponse.json({ success: true, message: "Aylık plan süreci başlatıldı." });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
