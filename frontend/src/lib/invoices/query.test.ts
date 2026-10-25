import { describe, expect, it } from "vitest";

import { invoiceListQuerySchema } from "./query";

describe("invoice list query", () => {
  it("parses allowlisted filters and bounded pagination", () => {
    expect(invoiceListQuerySchema.parse({ page: "2", pageSize: "25", sort: "due_soon", status: "overdue" })).toMatchObject({ page: 2, pageSize: 25, sort: "due_soon", status: "overdue" });
  });
  it("falls back from unsupported query values", () => {
    expect(invoiceListQuerySchema.parse({ page: "-1", pageSize: "500", sort: "sql", status: "unknown" })).toMatchObject({ page: 1, pageSize: 10, sort: "newest", status: "all" });
  });
});
