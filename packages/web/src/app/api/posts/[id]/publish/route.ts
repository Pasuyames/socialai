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

  // Yayınlama SENKRON çalışır — arka plana atılmaz.
  //
  // Eskiden fire-and-forget'ti ve route koşulsuz {ok:true} dönüyordu: kimlik
  // bilgileri eksikken veya Instagram API hata verdiğinde bile kullanıcı
  // "yayınlandı" görüyor, gerçek sonucu yalnızca AgentLog'a bakarsa öğreniyordu.
  // Yayın, ajan zincirleri gibi dakikalar süren bir iş değil (tek API çağrısı,
  // içeride 30 sn timeout'lu) — sonucu beklemek doğru davranış.
  const ok = await new PublisherAgent()
    .execute(postId)
    .catch(async (err) => {
      await logBgError("Gönderi yayınlama", "Post", postId)(err);
      return false;
    });

  if (!ok) {
    return NextResponse.json(
      { error: "Yayınlanamadı. Ayrıntı için aktivite kaydına bakın." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
