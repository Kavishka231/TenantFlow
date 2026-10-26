export const billingPlanKeys = ["free", "starter", "growth"] as const;
export type BillingPlanKey = (typeof billingPlanKeys)[number];

export const planCatalog = {
  free: {
    name: "Free",
    description: "Core workspace tools for small teams getting started.",
    monthlyPriceMinor: 0,
    features: ["Workspace and team access", "25 customers", "25 invoices"],
  },
  starter: {
    name: "Starter",
    description: "Higher limits for growing service businesses.",
    monthlyPriceMinor: 2900,
    features: ["Everything in Free", "500 customers", "1,000 invoices"],
  },
  growth: {
    name: "Growth",
    description: "Unlimited capacity for established teams.",
    monthlyPriceMinor: 7900,
    features: ["Everything in Starter", "Unlimited customers", "Unlimited invoices"],
  },
} as const;
