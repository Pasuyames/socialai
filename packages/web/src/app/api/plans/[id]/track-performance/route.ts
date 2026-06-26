import { NextResponse } from "next/server";
import { PerformanceTrackerAgent } from "@/lib/agents/PerformanceTracker";
import { authorizePlan } from "@/lib/authz";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const planId = parseInt(id);

  const az = await authorizePlan(planId);
  if (!az.ok) return az.error;

  const tracker = new PerformanceTrackerAgent();
  tracker.execute(planId).catch(console.error);

  return NextResponse.json({ ok: true });
}
