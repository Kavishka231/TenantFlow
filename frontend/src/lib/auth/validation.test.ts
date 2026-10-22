import { describe, expect, it } from "vitest";

import { getSafeRedirectPath } from "./redirect";
import { loginSchema, registrationSchema } from "./validation";

describe("authentication validation", () => {
  it("normalizes login email addresses", () => {
    const result = loginSchema.parse({
      email: "  USER@Example.COM ",
      password: "secret",
    });

    expect(result.email).toBe("user@example.com");
  });

  it("rejects weak or mismatched registration passwords", () => {
    const result = registrationSchema.safeParse({
      fullName: "Test User",
      email: "test@example.com",
      password: "short",
      confirmPassword: "different",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(["password", "confirmPassword"]),
      );
    }
  });
});

describe("post-authentication redirects", () => {
  it("allows local application paths", () => {
    expect(getSafeRedirectPath("/dashboard?tab=profile")).toBe(
      "/dashboard?tab=profile",
    );
  });

  it.each([
    "https://attacker.example",
    "//attacker.example",
    "/\\attacker.example",
    "/dashboard\nLocation: https://attacker.example",
    "javascript:alert(1)",
  ])(
    "rejects unsafe redirect %s",
    (path) => {
      expect(getSafeRedirectPath(path)).toBe("/dashboard");
    },
  );
});
