import { describe, expect, it } from "vitest";

import { receiptObjectPath, validateReceiptFile } from "./receipts";

describe("expense receipts", () => {
  it("accepts supported private receipt files", () => {
    expect(validateReceiptFile(new File(["receipt"], "receipt.pdf", { type: "application/pdf" }))).toMatchObject({ extension: "pdf", name: "receipt.pdf" });
  });
  it("rejects unsupported and empty files", () => {
    expect(validateReceiptFile(new File([], "empty.pdf", { type: "application/pdf" }))).toHaveProperty("error");
    expect(validateReceiptFile(new File(["x"], "script.html", { type: "text/html" }))).toHaveProperty("error");
  });
  it("builds a tenant and expense scoped object path", () => {
    expect(receiptObjectPath("org", "expense", "object", "pdf")).toBe("org/expense/object.pdf");
  });
});
