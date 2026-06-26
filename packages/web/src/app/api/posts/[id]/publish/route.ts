import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { POST_STATUS } from "@/lib/constants";
import { PublisherAgent } from "@/lib/agents/Publisher";
import { authorizePost } from "@/lib/authz";
import { logBgError } from "@/lib/bgError";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = parseInt(id);

  const az = await authorizePost(postId);
  if (!az.ok) return az.error;

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { status: true } });
  if (!post) return NextResponse.json({ error: "Post bulunamadı." }, { status: 404 });
  if (post.status !== POST_STATUS.APPROVED) {
    return NextResponse.json({ error: "Yayınlamak için önce onaylanmalı." }, { status: 400 });
  }

  // Arka planda yayınla
  const publisher = new PublisherAgent();
  publisher.execute(postId).catch(logBgError("Gönderi yayınlama", "Post", postId));

  return NextResponse.json({ ok: true });
}
