import { NextResponse } from "next/server";
import { ArchivistAgent } from "@/lib/agents/Archivist";
import { authorizePlan } from "@/lib/authz";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const planId = parseInt(id);

  const az = await authorizePlan(planId);
  if (!az.ok) return az.error;

  new ArchivistAgent().execute(planId).catch(console.error);

  return NextResponse.json({ success: true, message: "Arşivleme başlatıldı." });
}
