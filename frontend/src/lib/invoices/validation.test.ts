import { describe, expect, it } from "vitest";

import { createInvoiceSchema } from "./validation";

const baseInvoice = {
  currency: "usd",
  customerId: "00000000-0000-4000-8000-000000000002",
  discountMinor: 100,
  dueDate: "2027-02-28",
  issueDate: "2027-02-01",
  items: [{ description: "Consulting", quantity: 2, unitPriceMinor: 5_000 }],
  notes: "Net 30",
  organizationId: "00000000-0000-4000-8000-000000000001",
  taxRateBps: 1_000,
};

describe("invoice validation", () => {
  it("normalizes a valid invoice", () => {
    const result = createInvoiceSchema.parse(baseInvoice);
    expect(result.currency).toBe("USD");
    expect(result.items[0]).toEqual({
      description: "Consulting",
      quantity: 2,
      unitPriceMinor: 5_000,
    });
  });

  it("rejects cross-field date and discount errors", () => {
    const result = createInvoiceSchema.safeParse({
      ...baseInvoice,
      discountMinor: 20_000,
      dueDate: "2027-01-31",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map(({ message }) => message)).toEqual(
        expect.arrayContaining([
          "The due date cannot precede the issue date.",
          "The discount cannot exceed the invoice subtotal.",
        ]),
      );
    }
  });

  it("requires at least one bounded invoice item", () => {
    expect(createInvoiceSchema.safeParse({ ...baseInvoice, items: [] }).success).toBe(false);
    expect(
      createInvoiceSchema.safeParse({
        ...baseInvoice,
        items: [{ description: "Bad", quantity: 0, unitPriceMinor: -1 }],
      }).success,
    ).toBe(false);
  });
});
