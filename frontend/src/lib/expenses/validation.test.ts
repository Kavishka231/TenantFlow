import { describe, expect, it } from "vitest";

import { createExpenseSchema } from "./validation";

const valid = {
  amountMinor: "45.67",
  categoryId: "11111111-1111-4111-8111-111111111111",
  currency: "usd",
  description: "Hosting",
  expenseDate: "2026-10-28",
  organizationId: "22222222-2222-4222-8222-222222222222",
  paidDate: "2026-10-28",
  paymentMethod: "card",
  status: "paid",
  vendor: "Example Cloud",
};

describe("expense validation", () => {
  it("normalizes a valid paid expense", () => {
    const result = createExpenseSchema.parse(valid);
    expect(result.amountMinor).toBe(4567);
    expect(result.currency).toBe("USD");
  });

  it("requires payment dates only for paid or reimbursed expenses", () => {
    expect(createExpenseSchema.safeParse({ ...valid, paidDate: "", status: "paid" }).success).toBe(false);
    expect(createExpenseSchema.safeParse({ ...valid, paidDate: "2026-10-28", status: "pending" }).success).toBe(false);
    expect(createExpenseSchema.safeParse({ ...valid, paidDate: "", status: "pending" }).success).toBe(true);
  });
});
