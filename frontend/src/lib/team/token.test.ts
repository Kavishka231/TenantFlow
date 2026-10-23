import { describe, expect, it } from "vitest";

import { hashInvitationToken } from "./token";

describe("invitation token hashing", () => {
  it("creates deterministic SHA-256 hashes without retaining the token", () => {
    const token = "A".repeat(43);
    const hash = hashInvitationToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashInvitationToken(token)).toBe(hash);
    expect(hashInvitationToken(`${token}B`)).not.toBe(hash);
  });
});
