import { NextResponse } from "next/server";
import { authorizePost } from "@/lib/authz";
import { approvePost } from "@/lib/postActions";

// POST /api/posts/[id]/approve — ajans arayüzü (oturum ile yetkilendirilir).
// Davranış lib/postActions.ts'te tek yerde durur; müşteri portalının
// /api/client/[token]/posts/[id]/approve ucu da AYNI fonksiyonu çağırır.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = parseInt(id);

  const az = await authorizePost(postId);
  if (!az.ok) return az.error;

  await approvePost(postId);
  return NextResponse.json({ ok: true });
}
