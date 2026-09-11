import { NextResponse } from "next/server";
import { authorizePost } from "@/lib/authz";
import { requestRevision, validateRevisionNotes } from "@/lib/postActions";

// POST /api/posts/[id]/revise — ajans arayüzü (oturum ile yetkilendirilir).
// Davranış lib/postActions.ts'te tek yerde durur; müşteri portalının
// /api/client/[token]/posts/[id]/revise ucu da AYNI fonksiyonu çağırır.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = parseInt(id);

  const az = await authorizePost(postId);
  if (!az.ok) return az.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const notes = validateRevisionNotes((body as { revisionNotes?: unknown } | null)?.revisionNotes);
  if (!notes.ok) return NextResponse.json({ error: notes.error }, { status: 400 });

  await requestRevision(postId, notes.notes);
  return NextResponse.json({ ok: true });
}
