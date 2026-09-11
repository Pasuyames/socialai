import { NextResponse } from "next/server";
import { POST_STATUS } from "@/lib/constants";
import { rateLimitOrError } from "@/lib/rateLimit";
import { requestRevision, validateRevisionNotes } from "@/lib/postActions";
import {
  authorizeClientPost,
  clientActionKey,
  CLIENT_ACTION_LIMIT,
  CLIENT_ACTION_WINDOW_MS,
} from "../../../_lib/authorize";

// POST /api/client/[token]/posts/[id]/revise
// Müşteri portalının "Revizyon İste" butonu. Ajans ucuyla (/api/posts/[id]/revise)
// AYNI davranışı çalıştırır — ikisi de lib/postActions.ts'i çağırır. Tek farkı
// yetkilendirmenin oturum yerine capability-token ile olması ve oturumsuz bir
// uç olduğu için ek kötüye kullanım korumaları taşıması.
export async function POST(req: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;

  const limited = rateLimitOrError(clientActionKey(token), CLIENT_ACTION_LIMIT, CLIENT_ACTION_WINDOW_MS);
  if (limited) return limited;

  const az = await authorizeClientPost(token, id);
  if (!az.ok) return az.error;

  // Yayınlanmış içerik yeniden yazılmaz — ajan zinciri yayındaki metni bozar.
  if (az.status === POST_STATUS.PUBLISHED) {
    return NextResponse.json({ error: "Yayınlanmış içerik için revizyon istenemez." }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const notes = validateRevisionNotes((body as { revisionNotes?: unknown } | null)?.revisionNotes);
  if (!notes.ok) return NextResponse.json({ error: notes.error }, { status: 400 });

  await requestRevision(az.postId, notes.notes);
  return NextResponse.json({ ok: true });
}
