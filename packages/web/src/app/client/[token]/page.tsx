import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import ClientPortalView from "./ClientPortalView";

export const dynamic = "force-dynamic";

export default async function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const plan = await prisma.monthlyPlan.findUnique({
    where: { clientToken: token },
    include: {
      brand: { select: { name: true, brandColor: true, logoPath: true } },
      posts: { orderBy: { scheduledAt: "asc" } },
    },
  });

  if (!plan) return notFound();

  const MONTH_NAMES = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  return (
    <ClientPortalView
      token={token}
      plan={{
        id: plan.id,
        month: plan.month,
        year: plan.year,
        monthName: MONTH_NAMES[plan.month] ?? String(plan.month),
        reportPath: plan.reportPath,
        brand: plan.brand as any,
        posts: plan.posts as any,
      }}
    />
  );
}
