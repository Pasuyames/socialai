import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// ─── Müşteri portalı yetkilendirmesi (capability-token) ──────────────────────
//
// Portal ziyaretçisinin OTURUMU YOKTUR; tek kimlik kanıtı URL'deki tahmin
// edilemez `clientToken`'dır. Bu yüzden burada `authorizePost()` (oturum tabanlı)
// KULLANILMAZ — bkz. `report/route.ts`, aynı desen.
//
// Kritik nokta: token'ı doğrulamak TEK BAŞINA yetmez. Postun gerçekten O TOKEN'A
// ait plana bağlı olduğu da doğrulanmalıdır; aksi halde geçerli bir token'a sahip
// müşteri, gövdeye/URL'e başka bir id yazarak BAŞKA bir müşterinin postunu
// onaylayabilir (IDOR).

export type ClientPostAuth =
  | { ok: true; postId: number; status: string }
  | { ok: false; error: NextResponse };

export async function authorizeClientPost(token: string, id: string): Promise<ClientPostAuth> {
  if (!token || token.length < 16) {
    return { ok: false, error: NextResponse.json({ error: "Geçersiz token." }, { status: 400 }) };
  }

  const plan = await prisma.monthlyPlan.findUnique({
    where: { clientToken: token },
    select: { id: true },
  });
  if (!plan) {
    return { ok: false, error: NextResponse.json({ error: "Plan bulunamadı." }, { status: 404 }) };
  }

  const postId = parseInt(id);
  if (Number.isNaN(postId)) {
    return { ok: false, error: NextResponse.json({ error: "Geçersiz post id." }, { status: 400 }) };
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { planId: true, status: true },
  });
  if (!post) {
    return { ok: false, error: NextResponse.json({ error: "Post bulunamadı." }, { status: 404 }) };
  }

  // IDOR kapısı: post başka bir plana aitse token bu post için geçerli değildir.
  if (post.planId !== plan.id) {
    return { ok: false, error: NextResponse.json({ error: "Bu içeriğe erişiminiz yok." }, { status: 403 }) };
  }

  return { ok: true, postId, status: post.status };
}

// Portal aksiyonları için ortak hız sınırı anahtarı.
// Tek bütçe (approve + revize birlikte) bilinçli bir tercih: kötüye kullanım
// senaryosunda saldırgan endpoint'ler arasında gezinerek limiti ikiye katlayamaz.
// 60 istek / 10 dk, gerçek kullanım için fazlasıyla geniştir (bir planda ~12 post
// var, müşteri her birine en fazla birkaç kez dokunur) ama revizyon LLM zincirini
// (ContentWriter + EditorInChief = maliyet) döngüye sokmayı anlamsız kılar.
export const CLIENT_ACTION_LIMIT = 60;
export const CLIENT_ACTION_WINDOW_MS = 600_000; // 10 dakika
export const clientActionKey = (token: string) => `client:${token}`;
