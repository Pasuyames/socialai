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
