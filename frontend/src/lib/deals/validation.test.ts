import { describe, expect, it } from "vitest";

import { createDealSchema, transitionDealSchema } from "./validation";

const id = "00000000-0000-4000-8000-000000000001";

describe("deal validation", () => {
  it("normalizes optional values and currency", () => {
    const result = createDealSchema.parse({ organizationId: id, customerId: id, stageId: id, assignedUserId: "", title: "  Renewal  ", description: "", valueMinor: 12000, currency: "usd", expectedCloseDate: "" });
    expect(result).toMatchObject({ title: "Renewal", currency: "USD", assignedUserId: null, description: null, expectedCloseDate: null });
  });

  it("rejects floating money, malformed currency, and excessive values", () => {
    expect(createDealSchema.safeParse({ organizationId: id, customerId: id, stageId: id, title: "Deal", valueMinor: 1.2, currency: "USD" }).success).toBe(false);
    expect(createDealSchema.safeParse({ organizationId: id, customerId: id, stageId: id, title: "Deal", valueMinor: 1, currency: "US" }).success).toBe(false);
  });

  it("bounds outcome reasons", () => {
    expect(transitionDealSchema.safeParse({ organizationId: id, dealId: id, stageId: id, version: 1, outcomeReason: "x".repeat(501) }).success).toBe(false);
  });
});
