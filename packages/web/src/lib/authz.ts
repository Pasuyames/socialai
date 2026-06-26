import { NextResponse } from "next/server";
import { auth } from "./auth";
import prisma from "./db";

// ─── API Yetkilendirme Yardımcıları ──────────────────────────────────────────
//
// Cross-tenant IDOR koruması: bir API route'u bir kaynağa (plan/post/brand)
// dokunmadan önce, çağıran kullanıcının O kaynağın organizasyonuna ait olduğunu
// doğrular. superadmin tüm kaynaklara erişebilir.
//
// Kullanım:
//   const az = await authorizePlan(planId);
//   if (!az.ok) return az.error;
//   // az.orgId, az.userId, az.isAdmin kullanılabilir
//

type Ok = {
  ok: true;
  userId: number;
  orgId: number;
  isAdmin: boolean;
};
type Fail = { ok: false; error: NextResponse };
type AuthzResult = Ok | Fail;

function deny(status: number, message: string): Fail {
  return { ok: false, error: NextResponse.json({ error: message }, { status }) };
}

// Oturumu çözer ve temel kimlik bilgilerini döndürür
async function getSession(): Promise<AuthzResult> {
  const session = await auth();
  if (!session?.user) return deny(401, "Oturum gerekli.");

  const userId = parseInt((session.user as any).id);
  const orgId  = parseInt((session.user as any).organizationId);
  const isAdmin = (session.user as any).role === "superadmin";

  // superadmin'in org'u olmayabilir; normal kullanıcıda geçerli org zorunlu
  if (!isAdmin && (isNaN(orgId) || isNaN(userId))) {
    return deny(403, "Geçersiz oturum / organizasyon.");
  }
  return { ok: true, userId, orgId, isAdmin };
}

// Sadece kimlik doğrulama gerektiren route'lar için
export async function authorize(): Promise<AuthzResult> {
  return getSession();
}

// superadmin zorunlu route'lar için
export async function authorizeAdmin(): Promise<AuthzResult> {
  const s = await getSession();
  if (!s.ok) return s;
  if (!s.isAdmin) return deny(403, "Bu işlem için yönetici yetkisi gerekli.");
  return s;
}

// Kaynağın org'u kullanıcının org'uyla eşleşiyor mu? (superadmin bypass)
function checkOwnership(s: Ok, resourceOrgId: number | null): AuthzResult {
  if (s.isAdmin) return s;
  if (resourceOrgId == null) return deny(403, "Bu kaynağa erişim yetkiniz yok.");
  if (resourceOrgId !== s.orgId) return deny(403, "Bu kaynağa erişim yetkiniz yok.");
  return s;
}

// ─── Kaynak-bazlı yetkilendirme ───────────────────────────────────────────────

export async function authorizeBrand(brandId: number): Promise<AuthzResult> {
  const s = await getSession();
  if (!s.ok) return s;
  if (isNaN(brandId)) return deny(400, "Geçersiz marka ID.");

  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { organizationId: true },
  });
  if (!brand) return deny(404, "Marka bulunamadı.");
  return checkOwnership(s, brand.organizationId);
}

export async function authorizePlan(planId: number): Promise<AuthzResult> {
  const s = await getSession();
  if (!s.ok) return s;
  if (isNaN(planId)) return deny(400, "Geçersiz plan ID.");

  const plan = await prisma.monthlyPlan.findUnique({
    where: { id: planId },
    select: { brand: { select: { organizationId: true } } },
  });
  if (!plan) return deny(404, "Plan bulunamadı.");
  return checkOwnership(s, plan.brand.organizationId);
}

export async function authorizePost(postId: number): Promise<AuthzResult> {
  const s = await getSession();
  if (!s.ok) return s;
  if (isNaN(postId)) return deny(400, "Geçersiz gönderi ID.");

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { plan: { select: { brand: { select: { organizationId: true } } } } },
  });
  if (!post) return deny(404, "Gönderi bulunamadı.");
  return checkOwnership(s, post.plan.brand.organizationId);
}
