import { describe, expect, it } from "vitest";

import { expenseListOffset, expenseListQuerySchema } from "./query";

describe("expense list query", () => {
  it("bounds malformed query values", () => {
    const query = expenseListQuerySchema.parse({ page: "-1", pageSize: "999", q: "  cloud  ", sort: "unsafe", status: "unknown" });
    expect(query).toMatchObject({ page: 1, pageSize: 10, q: "cloud", sort: "newest", status: "all" });
  });

  it("calculates a bounded page offset", () => {
    const query = expenseListQuerySchema.parse({ page: "3", pageSize: "25" });
    expect(expenseListOffset(query)).toBe(50);
  });
});
