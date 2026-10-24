import { describe, expect, it } from "vitest";

import { customerListOffset, customerListQuerySchema } from "./query";

describe("customer list query", () => {
  it("normalizes valid search controls", () => {
    const query = customerListQuerySchema.parse({
      page: "3",
      pageSize: "25",
      q: "  Acme  ",
      sort: "recently_updated",
      status: "active",
    });

    expect(query).toEqual({
      page: 3,
      pageSize: 25,
      q: "Acme",
      sort: "recently_updated",
      status: "active",
    });
    expect(customerListOffset(query)).toBe(50);
  });

  it("falls back safely for invalid pagination and filters", () => {
    expect(
      customerListQuerySchema.parse({
        page: "-5",
        pageSize: "1000",
        q: "x".repeat(101),
        sort: "drop_table",
        status: "deleted",
      }),
    ).toEqual({
      page: 1,
      pageSize: 10,
      q: "",
      sort: "name_asc",
      status: "all",
    });
  });
});
