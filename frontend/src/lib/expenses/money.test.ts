import { describe, expect, it } from "vitest";

import { expenseAmountInput, parseExpenseAmount } from "./money";

describe("expense money", () => {
  it("converts decimal input without floating-point arithmetic", () => {
    expect(parseExpenseAmount("19.99")).toBe(1999);
    expect(parseExpenseAmount("12.5")).toBe(1250);
    expect(expenseAmountInput(1250)).toBe("12.50");
  });

  it("rejects invalid, zero, over-precise, and excessive values", () => {
    expect(parseExpenseAmount("0")).toBeNull();
    expect(parseExpenseAmount("1.999")).toBeNull();
    expect(parseExpenseAmount("-2")).toBeNull();
    expect(parseExpenseAmount("10000000001")).toBeNull();
  });
});
