import { describe, expect, it } from "vitest";

import { mergeExpenseTotals } from "./reports-model";

describe("expense report totals", () => {
  it("keeps currencies separate", () => {
    expect(mergeExpenseTotals([{ amountMinor: 1000, currency: "USD", paidMinor: 800 }, { amountMinor: 2000, currency: "LKR", paidMinor: 2000 }])).toEqual([
      { amountMinor: 1000, currency: "USD", paidMinor: 800 },
      { amountMinor: 2000, currency: "LKR", paidMinor: 2000 },
    ]);
  });
});
