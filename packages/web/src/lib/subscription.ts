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

type PlanLimits = (typeof PLAN_LIMITS)[PlanTier];

// Plan alanları iki farklı sınıfa ayrılır ve ASLA aynı yardımcıyla sorgulanmaz:
//   • Sayısal kota  (maxBrands, maxPlansPerMonth, maxPostsPerPlan) → checkLimit()
//   • Boolean özellik (clientPortal, imagenEnabled, prioritySupport) → hasFeature()
// Tip seviyesinde ayrıştırıldığı için yanlış yardımcıyı çağırmak derleme hatası verir.
export type NumericLimit = Exclude<
  { [K in keyof PlanLimits]: PlanLimits[K] extends number ? K : never }[keyof PlanLimits],
  "priceMonthly"
>;
export type PlanFeature =
  { [K in keyof PlanLimits]: PlanLimits[K] extends boolean ? K : never }[keyof PlanLimits];

const RESOURCE_LABELS: Record<NumericLimit, string> = {
  maxBrands:        "marka",
  maxPlansPerMonth: "aylık plan",
  maxPostsPerPlan:  "plan başına gönderi",
};

const FEATURE_LABELS: Record<PlanFeature, string> = {
  imagenEnabled:   "AI görsel üretimi",
  clientPortal:    "müşteri portalı",
  prioritySupport: "öncelikli destek",
};

export function getPlanLimits(plan: string) {
  return PLAN_LIMITS[(plan as PlanTier) ?? "starter"] ?? PLAN_LIMITS.starter;
}

// ─── Sayısal kota kontrolü ───────────────────────────────────────────────────
// NOT: `resource` tipi bilinçli olarak sadece SAYISAL alanlarla sınırlıdır.
// Eskiden imza tüm plan alanlarını kabul ediyor, boolean alanlarda ise sessizce
// { allowed: true } dönüyordu — yani "clientPortal" gibi bir özellik yanlışlıkla
// buraya verilirse kapı tamamen açılıyordu. Artık hem tip hem de çalışma zamanı
// bu durumu kapatıyor (fail-closed).
export function checkLimit(
  plan: string,
  resource: NumericLimit,
  currentCount: number,
): { allowed: boolean; limit: number; message?: string } {
  const limits = getPlanLimits(plan);
  const limit  = limits[resource] as unknown;
  if (typeof limit !== "number") {
    // Sayısal olmayan alan → izin VERME. Boolean özellikler hasFeature() ile sorulmalı.
    return {
      allowed: false,
      limit: 0,
      message: `"${String(resource)}" sayısal bir plan kotası değil; bu alan hasFeature() ile kontrol edilmeli.`,
    };
  }
  if (currentCount >= limit) {
    return {
      allowed: false,
      limit,
      message: `${limits.label} planında maksimum ${limit} ${RESOURCE_LABELS[resource] ?? resource} limitine ulaştınız. Planı yükseltin.`,
    };
  }
  return { allowed: true, limit };
}

// ─── Boolean özellik kapısı ──────────────────────────────────────────────────
// Planın bir özelliği İÇERİP içermediğini söyler. İçermiyorsa mesaj, özelliğin
// hangi planlarda açık olduğunu da söyleyerek yükseltmeye yönlendirir.
export function hasFeature(
  plan: string,
  feature: PlanFeature,
): { allowed: boolean; message?: string } {
  const limits = getPlanLimits(plan);
  if (limits[feature] === true) return { allowed: true };

  const label = FEATURE_LABELS[feature] ?? String(feature);
  const upgradeTiers = (Object.keys(PLAN_LIMITS) as PlanTier[])
    .filter((tier) => PLAN_LIMITS[tier][feature])
    .map((tier) => PLAN_LIMITS[tier].label);

  const upgradeHint = upgradeTiers.length
    ? ` Bu özelliği kullanmak için ${upgradeTiers.join(" veya ")} planına yükseltin.`
    : "";

  return {
    allowed: false,
    message: `${limits.label} planı ${label} özelliğini içermiyor.${upgradeHint}`,
  };
}
