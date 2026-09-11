import { auth } from "./auth";
import { redirect } from "next/navigation";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
  organizationSlug: string;
  organizationPlan: string;
};

export async function requireAuth(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user as unknown as SessionUser;
}

export async function getOrgId(): Promise<number> {
  const user = await requireAuth();
  return parseInt(user.organizationId);
}

/**
 * Dashboard sayfaları için veri kapsamı — FAIL-CLOSED.
 *
 * Sayfalar eskiden şu deseni kullanıyordu:
 *     const orgId = session?.user ? parseInt(...) : null;
 *     where: orgId ? { organizationId: orgId } : {}     // ← oturum yoksa HER ŞEY
 *
 * Yani oturum çözülemediğinde (veya organizationId NaN geldiğinde) filtre boş
 * kalıp TÜM organizasyonların verisini döndürüyordu. Pratikte middleware araya
 * girdiği için sömürülemiyordu, ama tek bir middleware regresyonu bunu doğrudan
 * çapraz-kiracı sızıntısına çeviriyordu. Varsayılan artık tersine çevrildi:
 * kimlik belirsizse veri YOK.
 *
 *  - Oturum yoksa            → /login'e yönlendirilir
 *  - Normal kullanıcı        → yalnızca kendi org'u (org'u yoksa /login)
 *  - superadmin (org'suz)    → seesAll: true, tüm kayıtlar
 *  - superadmin (org'lu)     → kendi org'u (mevcut davranış korunur)
 */
export async function getScope(): Promise<{
  orgId: number | null;
  isAdmin: boolean;
  seesAll: boolean;
}> {
  const user = await requireAuth();
  const isAdmin = user.role === "superadmin";
  const parsed = parseInt(user.organizationId);
  const orgId = Number.isNaN(parsed) ? null : parsed;

  if (orgId === null && !isAdmin) redirect("/login");

  return { orgId, isAdmin, seesAll: isAdmin && orgId === null };
}
