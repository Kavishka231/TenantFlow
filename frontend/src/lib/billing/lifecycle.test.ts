import { describe, expect, it } from "vitest";

import { hasPaidPlanAccess, subscriptionNotice } from "./lifecycle";

describe("subscription lifecycle", () => {
  it("grants paid entitlements only to supported lifecycle states", () => {
    expect(hasPaidPlanAccess("active")).toBe(true);
    expect(hasPaidPlanAccess("trialing")).toBe(true);
    expect(hasPaidPlanAccess("past_due")).toBe(true);
    expect(hasPaidPlanAccess("unpaid")).toBe(false);
    expect(hasPaidPlanAccess("canceled")).toBe(false);
  });

  it("explains scheduled cancellation without changing Stripe state locally", () => {
    expect(subscriptionNotice({
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date("2030-01-02T00:00:00.000Z"),
      status: "active",
    })).toContain("1/2/2030");
  });
});
