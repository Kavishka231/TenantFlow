import { describe, expect, it } from "vitest";

import { buildMonthlyFinancialSeries, monthKeys } from "./buckets";

describe("monthly financial analytics", () => {
  it("creates inclusive calendar-month buckets", () => {
    expect(monthKeys("2026-01-20", "2026-04-02")).toEqual([
      "2026-01", "2026-02", "2026-03", "2026-04",
    ]);
  });

  it("keeps currencies separate and fills missing months with zero", () => {
    const result = buildMonthlyFinancialSeries(
      ["2026-01", "2026-02"],
      [
        { month: "2026-01", currency: "USD", amountMinor: 10000 },
        { month: "2026-02", currency: "EUR", amountMinor: 7000 },
      ],
      [{ month: "2026-02", currency: "USD", amountMinor: 4000 }],
    );
    expect(result).toEqual([
      { currency: "EUR", points: [
        { month: "2026-01", invoicedMinor: 0, paidMinor: 0 },
        { month: "2026-02", invoicedMinor: 7000, paidMinor: 0 },
      ] },
      { currency: "USD", points: [
        { month: "2026-01", invoicedMinor: 10000, paidMinor: 0 },
        { month: "2026-02", invoicedMinor: 0, paidMinor: 4000 },
      ] },
    ]);
  });
});
