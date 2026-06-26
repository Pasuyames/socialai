import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { POST_STATUS } from "@/lib/constants";
import { authorizePost } from "@/lib/authz";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = parseInt(id);

  const az = await authorizePost(postId);
  if (!az.ok) return az.error;

  await prisma.post.update({
    where: { id: postId },
    data: { status: POST_STATUS.APPROVED },
  });

  await prisma.agentLog.create({
    data: {
      agentName: "Kullanıcı",
      action: "Post onaylandı.",
      targetType: "Post",
      targetId: postId,
    },
  });

  return NextResponse.json({ ok: true });
}
