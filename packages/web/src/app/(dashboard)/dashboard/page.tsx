import prisma from "@/lib/db";
import { getScope } from "@/lib/session";
import { agentLogOrgWhere } from "@/lib/agentLogScope";
import { getQueueCounts, getLangfuseMetrics } from "@/lib/observability";
import { DashboardCockpit, type CockpitData } from "@/components/dashboard/DashboardCockpit";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Fail-closed kapsam: kimlik belirsizse veri yok (bkz. lib/session.ts getScope)
  const { orgId, seesAll } = await getScope();

  const brandWhere = seesAll ? {} : { organizationId: orgId! };
  const postWhere  = seesAll ? {} : { plan: { brand: { organizationId: orgId! } } };

  // AgentLog org'a göre filtrelenmeli (çok-kiracılı izolasyon) — hedef sahipliği üzerinden.
  const logScope = await agentLogOrgWhere(orgId);

  const [
    brandCount, planCount, postCount, approvedCount,
    recentLogs, recentContent, queue, langfuse,
  ] = await Promise.all([
    prisma.brand.count({ where: brandWhere }),
    prisma.monthlyPlan.count({ where: seesAll ? {} : { brand: { organizationId: orgId! } } }),
    prisma.post.count({ where: postWhere }),
    prisma.post.count({ where: { ...postWhere, status: { in: ["client_review", "approved", "published"] } } }),
    prisma.agentLog.findMany({ where: logScope, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.post.findMany({
      where: postWhere,
      include: { plan: { include: { brand: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    getQueueCounts(),
    getLangfuseMetrics(),
  ]);

  const data: CockpitData = {
    stats: { brands: brandCount, plans: planCount, posts: postCount, approved: approvedCount },
    queue,
    langfuse,
    logs: recentLogs.map((l) => ({
      id: l.id,
      agentName: l.agentName,
      action: l.action,
      createdAt: l.createdAt.toISOString(),
    })),
    content: recentContent.map((p) => ({
      id: p.id,
      brandName: p.plan.brand.name,
      topic: p.topic ?? "",
      status: p.status,
      imagePath: p.imagePath,
      scheduledAt: p.scheduledAt ? p.scheduledAt.toISOString() : null,
    })),
  };

  return <DashboardCockpit data={data} />;
}
