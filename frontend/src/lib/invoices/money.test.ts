import { describe, expect, it } from "vitest";

import { calculateInvoiceTotals, effectiveInvoiceStatus } from "./money";

describe("invoice calculations", () => {
  it("calculates quantity, discounts, and basis-point tax in minor units", () => {
    expect(
      calculateInvoiceTotals(
        [
          { quantity: 2, unitPriceMinor: 1_999 },
          { quantity: 1, unitPriceMinor: 502 },
        ],
        500,
        1_250,
      ),
    ).toEqual({ subtotalMinor: 4_500, taxMinor: 500, totalMinor: 4_500 });
  });

  it("rounds tax half-up without floating point arithmetic", () => {
    expect(calculateInvoiceTotals([{ quantity: 1, unitPriceMinor: 5 }], 0, 1_000).taxMinor).toBe(1);
  });

  it("rejects discounts above subtotal", () => {
    expect(() => calculateInvoiceTotals([{ quantity: 1, unitPriceMinor: 100 }], 101, 0)).toThrow(
      "discount cannot exceed",
    );
  });

  it("derives overdue only from an unpaid sent invoice", () => {
    expect(effectiveInvoiceStatus("sent", "2027-01-01", "2027-01-02")).toBe("overdue");
    expect(effectiveInvoiceStatus("paid", "2027-01-01", "2027-01-02")).toBe("paid");
  });
});
