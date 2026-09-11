import { NextResponse } from "next/server";
import { rateLimitOrError } from "@/lib/rateLimit";
import { approvePost } from "@/lib/postActions";
import {
  authorizeClientPost,
  clientActionKey,
  CLIENT_ACTION_LIMIT,
  CLIENT_ACTION_WINDOW_MS,
} from "../../../_lib/authorize";

// POST /api/client/[token]/posts/[id]/approve
// Müşteri portalının onay butonu. Ajans ucuyla (/api/posts/[id]/approve) AYNI
// davranışı çalıştırır — ikisi de lib/postActions.ts'i çağırır. Tek farkı
// yetkilendirmenin oturum yerine capability-token ile olması: portal
// ziyaretçisinin oturumu yoktur, oturumlu route'ta 307 → /login yiyordu.
export async function POST(_req: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;

  const limited = rateLimitOrError(clientActionKey(token), CLIENT_ACTION_LIMIT, CLIENT_ACTION_WINDOW_MS);
  if (limited) return limited;

  const az = await authorizeClientPost(token, id);
  if (!az.ok) return az.error;

  // Idempotanlık (zaten onaylı/yayında ise sessizce geç) approvePost içinde.
  await approvePost(az.postId);
  return NextResponse.json({ ok: true });
}
