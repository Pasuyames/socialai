import prisma from "./db";

/**
 * AgentLog kayıtları org'a göre değil HEDEFE (Brand/Plan/Post) göre tutulur
 * (şemada organizationId yok). Bu yardımcı, bir organizasyona AİT hedefler
 * üzerinden AgentLog filtreleme `where` klozu üretir — böylece bir müşteri
 * başka müşterinin ajan aktivitesini GÖREMEZ (çok-kiracılı izolasyon).
 *
 * Geçersiz org (null/NaN) → hiçbir kayıt eşleşmez (güvenli varsayılan; sızıntı
 * riskine karşı "kapalı" tarafta hata yapar).
 */
export async function agentLogOrgWhere(orgId: number | null | undefined) {
  if (orgId == null || Number.isNaN(orgId)) {
    return { id: -1 }; // eşleşme yok
  }
  const [brands, plans, posts] = await Promise.all([
    prisma.brand.findMany({ where: { organizationId: orgId }, select: { id: true } }),
    prisma.monthlyPlan.findMany({ where: { brand: { organizationId: orgId } }, select: { id: true } }),
    prisma.post.findMany({ where: { plan: { brand: { organizationId: orgId } } }, select: { id: true } }),
  ]);
  return {
    OR: [
      { targetType: "Brand", targetId: { in: brands.map((b) => b.id) } },
      { targetType: "Plan",  targetId: { in: plans.map((p) => p.id) } },
      { targetType: "Post",  targetId: { in: posts.map((p) => p.id) } },
    ],
  };
}
