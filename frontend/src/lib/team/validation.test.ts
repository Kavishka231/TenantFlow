import { describe, expect, it } from "vitest";

import {
  createInvitationSchema,
  invitationTokenSchema,
} from "./validation";

describe("team invitation validation", () => {
  it("normalizes an invitation email", () => {
    const result = createInvitationSchema.parse({
      organizationId: "00000000-0000-4000-8000-000000000001",
      email: "  MEMBER@Example.com ",
      role: "member",
    });

    expect(result.email).toBe("member@example.com");
  });

  it("does not allow invitations to grant owner", () => {
    expect(
      createInvitationSchema.safeParse({
        organizationId: "00000000-0000-4000-8000-000000000001",
        email: "member@example.com",
        role: "owner",
      }).success,
    ).toBe(false);
  });

  it("accepts URL-safe high-entropy tokens only", () => {
    expect(invitationTokenSchema.safeParse("a".repeat(43)).success).toBe(true);
    expect(invitationTokenSchema.safeParse("short").success).toBe(false);
    expect(invitationTokenSchema.safeParse(`${"a".repeat(42)}+`).success).toBe(
      false,
    );
  });
});
