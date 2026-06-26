import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { POST_STATUS } from "@/lib/constants";
import { CopywriterAgent } from "@/lib/agents/Copywriter";
import { EditorInChiefAgent } from "@/lib/agents/EditorInChief";
import { authorizePost } from "@/lib/authz";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = parseInt(id);

  const az = await authorizePost(postId);
  if (!az.ok) return az.error;

  const { revisionNotes } = await req.json();
  if (!revisionNotes?.trim()) return NextResponse.json({ error: "Revizyon notu boş olamaz." }, { status: 400 });

  await prisma.post.update({
    where: { id: postId },
    data: { status: POST_STATUS.NEEDS_REWRITE, revisionNotes },
  });

  await prisma.agentLog.create({
    data: {
      agentName: "Kullanıcı",
      action: `Revizyon talebi: ${revisionNotes.slice(0, 100)}`,
      targetType: "Post",
      targetId: postId,
    },
  });

  // Arka planda Copywriter + EditorInChief çalıştır
  (async () => {
    const copy   = new CopywriterAgent();
    const editor = new EditorInChiefAgent();
    const ok1 = await copy.execute(postId);
    if (ok1) {
      const ok2 = await editor.execute(postId);
      if (ok2) {
        await prisma.post.update({
          where: { id: postId },
          data: { status: POST_STATUS.CLIENT_REVIEW },
        });
      }
    }
  })().catch(console.error);

  return NextResponse.json({ ok: true });
}
