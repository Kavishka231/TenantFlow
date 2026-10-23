import { describe, expect, it } from "vitest";

import {
  createOrganizationSchema,
  slugifyOrganizationName,
} from "./validation";

describe("organization creation validation", () => {
  it("normalizes valid workspace slugs", () => {
    const result = createOrganizationSchema.parse({
      name: "  Acme Technologies  ",
      slug: "  ACME-TECH  ",
    });

    expect(result).toEqual({ name: "Acme Technologies", slug: "acme-tech" });
  });

  it.each(["-acme", "acme-", "acme--team", "acme_team", "Acme Team"])(
    "rejects unsafe slug %s",
    (slug) => {
      expect(
        createOrganizationSchema.safeParse({ name: "Acme", slug }).success,
      ).toBe(false);
    },
  );

  it("creates a deterministic URL-safe suggestion", () => {
    expect(slugifyOrganizationName("  Café & Design Studio  ")).toBe(
      "cafe-design-studio",
    );
  });
});
