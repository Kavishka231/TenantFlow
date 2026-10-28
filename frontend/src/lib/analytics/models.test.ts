import { describe, expect, it } from "vitest";

import { buildCustomerGrowth, mergeRecentActivity } from "./models";

describe("analytics chart models", () => {
  it("builds cumulative customer growth from a pre-range baseline", () => {
    expect(buildCustomerGrowth(["2026-01", "2026-02", "2026-03"], 4, [
      { month: "2026-01", count: 2 }, { month: "2026-03", count: 3 },
    ])).toEqual([
      { month: "2026-01", newCustomers: 2, totalCustomers: 6 },
      { month: "2026-02", newCustomers: 0, totalCustomers: 6 },
      { month: "2026-03", newCustomers: 3, totalCustomers: 9 },
    ]);
  });

  it("merges recent activity deterministically without fabricated rows", () => {
    const older = { id: "a", type: "customer_created" as const, title: "A", description: "", occurredAt: new Date("2026-01-01") };
    const newer = { id: "b", type: "invoice_created" as const, title: "B", description: "", occurredAt: new Date("2026-02-01") };
    expect(mergeRecentActivity([[older], [newer]], 1)).toEqual([newer]);
    expect(mergeRecentActivity([], 8)).toEqual([]);
  });
});
