import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { POST_STATUS } from "@/lib/constants";
import { Orchestrator } from "@/lib/agents/Orchestrator";
import { authorizePost } from "@/lib/authz";
import { logBgError } from "@/lib/bgError";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = parseInt(id);

  const az = await authorizePost(postId);
  if (!az.ok) return az.error;

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { status: true, imagePrompt: true, planId: true },
  });

  if (!post) return NextResponse.json({ error: "Post bulunamadı." }, { status: 404 });

  if (post.status !== POST_STATUS.NEEDS_HUMAN) {
    return NextResponse.json(
      { error: `Post zaten işleniyor veya başka bir durumda (${post.status}).` },
      { status: 409 }
    );
  }

  // imagePrompt varsa görsel üretiminde takıldı — oradan devam et
  // imagePrompt yoksa metin yazımında takıldı — baştan başla
  const resumeStatus = post.imagePrompt
    ? POST_STATUS.IMAGE_PROMPT_READY
    : POST_STATUS.IDEATION;

  await prisma.post.update({
    where: { id: postId },
    data: { status: resumeStatus },
  });

  await prisma.agentLog.create({
    data: {
      agentName: "Kullanıcı",
      action: `NEEDS_HUMAN → ${resumeStatus} (yeniden başlatıldı).`,
      targetType: "Post",
      targetId: postId,
    },
  });

  if (resumeStatus === POST_STATUS.IMAGE_PROMPT_READY) {
    Orchestrator.startImageGenerationWithRetry(postId).catch(logBgError("Görsel üretimi (resume)", "Post", postId));
    return NextResponse.json({ ok: true, message: "Görsel üretimi yeniden başlatıldı." });
  } else {
    Orchestrator.startPostCreation(postId).catch(logBgError("Metin üretimi (resume)", "Post", postId));
    return NextResponse.json({ ok: true, message: "Metin üretimi baştan başlatıldı." });
  }
}
