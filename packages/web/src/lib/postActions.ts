import prisma from "./db";
import { POST_STATUS } from "./constants";
import { ContentWriterAgent } from "./agents/ContentWriter";
import { EditorInChiefAgent } from "./agents/EditorInChief";
import { logBgError } from "./bgError";

// ─── Gönderi Aksiyonları (onay / revizyon) — TEK KAYNAK ──────────────────────
//
// Aynı iki aksiyon İKİ ayrı yetkilendirme yolundan tetikleniyor:
//   • /api/posts/[id]/...                 → ajans arayüzü, oturum (authorizePost)
//   • /api/client/[token]/posts/[id]/...  → müşteri portalı, capability-token
//
// Mantık daha önce iki route'a KOPYALANMIŞTI ve tam olarak beklenen şey oldu:
// ajans ucu güncel ContentWriter motoruna taşınırken müşteri ucu eski
// Copywriter'da kaldı — yani revize edilen gönderi, isteği kimin yaptığına göre
// farklı formatta çıkıyordu. Bu modül o ikizliği ortadan kaldırır: route'lar
// yalnızca YETKİLENDİRMEden sorumludur, DAVRANIŞ burada tek yerde durur.

/**
 * Revizyon notu üst sınırı: not doğrudan LLM prompt'una ham girdi olarak gider.
 * Sınırsız metin hem token maliyeti hem bağlam taşması demek; 2000 karakter
 * gerçek bir revizyon talebi için fazlasıyla yeterli.
 */
export const MAX_REVISION_NOTES = 2000;

/** İstek gövdesinden gelen ham revizyon notunu doğrular ve normalize eder. */
export function validateRevisionNotes(
  raw: unknown,
): { ok: true; notes: string } | { ok: false; error: string } {
  const notes = typeof raw === "string" ? raw.trim() : "";
  if (!notes) return { ok: false, error: "Revizyon notu boş olamaz." };
  if (notes.length > MAX_REVISION_NOTES) {
    return { ok: false, error: `Revizyon notu en fazla ${MAX_REVISION_NOTES} karakter olabilir.` };
  }
  return { ok: true, notes };
}

/**
 * Gönderiyi onaylar.
 *
 * Idempotent: zaten `approved` veya `published` ise hiçbir şey yazmaz. Çift tık
 * ve yenilenen sekme AgentLog'u kirletmesin diye — ayrıca yayınlanmış bir
 * gönderiyi `approved`'a geri düşürmeyi de engeller.
 */
export async function approvePost(postId: number): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { status: true },
  });
  // Route çağırmadan önce zaten varlık kontrolü yaptı; buraya null düşmesi
  // ancak araya giren bir silme ile olur — sessizce geç.
  if (!post) return;
  if (post.status === POST_STATUS.APPROVED || post.status === POST_STATUS.PUBLISHED) return;

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
}

/**
 * Revizyon talebini kaydeder ve arka planda yeniden yazım zincirini başlatır.
 *
 * Notun ajana ULAŞMA yolu: gönderi burada `NEEDS_REWRITE` + `revisionNotes` ile
 * güncellenir; ContentWriter.execute() bu iki koşulu birlikte görünce notu
 * prompt'a "REVİZYON TALEBİ" bloğu olarak ekler ve işledikten sonra temizler.
 * Bu yüzden güncelleme, ajan tetiklenmeden ÖNCE yapılmak zorunda — sıra değişirse
 * müşterinin notu sessizce yok sayılır.
 *
 * Ajans ve müşteri uçlarının ikisi de ana üretim hattıyla (Orchestrator
 * .startPostCreation) AYNI motoru kullanır: ContentWriter caption + hashtags +
 * hook'u tek structured JSON çağrısında üretir.
 */
export async function requestRevision(postId: number, revisionNotes: string): Promise<void> {
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

  // Fire-and-forget: istemciyi ajan zincirinin süresi kadar bekletmeyiz.
  // Hata `.catch(console.error)` ile yutulmaz — logBgError AgentLog'a da yazar,
  // böylece takılan revizyon /admin/activity ekranında görünür.
  void (async () => {
    const ok1 = await new ContentWriterAgent().execute(postId);
    if (!ok1) return;
    const ok2 = await new EditorInChiefAgent().execute(postId);
    if (!ok2) return;
    await prisma.post.update({
      where: { id: postId },
      data: { status: POST_STATUS.CLIENT_REVIEW },
    });
  })().catch(logBgError("revizyon yeniden yazımı", "Post", postId));
}
