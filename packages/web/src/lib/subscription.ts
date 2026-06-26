export type PlanTier = "starter" | "pro" | "agency";

export const PLAN_LIMITS: Record<PlanTier, {
  label:      string;
  priceMonthly: number; // TRY
  maxBrands:  number;
  maxPlansPerMonth: number;
  maxPostsPerPlan:  number;
  imagenEnabled:    boolean;
  clientPortal:     boolean;
  prioritySupport:  boolean;
}> = {
  starter: {
    label:            "Starter",
    priceMonthly:     990,
    maxBrands:        2,
    maxPlansPerMonth: 2,
    maxPostsPerPlan:  12,
    imagenEnabled:    true,
    clientPortal:     false,
    prioritySupport:  false,
  },
  pro: {
    label:            "Pro",
    priceMonthly:     2490,
    maxBrands:        10,
    maxPlansPerMonth: 10,
    maxPostsPerPlan:  20,
    imagenEnabled:    true,
    clientPortal:     true,
    prioritySupport:  false,
  },
  agency: {
    label:            "Agency",
    priceMonthly:     5990,
    maxBrands:        999,
    maxPlansPerMonth: 999,
    maxPostsPerPlan:  30,
    imagenEnabled:    true,
    clientPortal:     true,
    prioritySupport:  true,
  },
};

export function getPlanLimits(plan: string) {
  return PLAN_LIMITS[(plan as PlanTier) ?? "starter"] ?? PLAN_LIMITS.starter;
}

export function checkLimit(
  plan: string,
  resource: keyof typeof PLAN_LIMITS.starter,
  currentCount: number,
): { allowed: boolean; limit: number; message?: string } {
  const limits = getPlanLimits(plan);
  const limit  = limits[resource] as number;
  if (typeof limit !== "number") return { allowed: true, limit: Infinity };
  if (currentCount >= limit) {
    const resourceLabel: Record<string, string> = {
      maxBrands:        "marka",
      maxPlansPerMonth: "aylık plan",
      maxPostsPerPlan:  "plan başına gönderi",
    };
    return {
      allowed: false,
      limit,
      message: `${limits.label} planında maksimum ${limit} ${resourceLabel[resource as string] ?? resource} limitine ulaştınız. Planı yükseltin.`,
    };
  }
  return { allowed: true, limit };
}
