import { describe, expect, it } from "vitest";

import {
  canChangeMemberRole,
  canRemoveMember,
  canTransferOwnership,
} from "./membership-policy";

const member = {
  actorId: "actor",
  actorRole: "owner" as const,
  targetRole: "member" as const,
  targetUserId: "target",
};

describe("membership policy", () => {
  it("allows owners to manage non-owner teammates", () => {
    expect(canChangeMemberRole(member)).toBe(true);
    expect(canRemoveMember(member)).toBe(true);
    expect(canTransferOwnership(member)).toBe(true);
  });

  it("allows admins to remove members but not grant roles", () => {
    const context = { ...member, actorRole: "admin" as const };

    expect(canChangeMemberRole(context)).toBe(false);
    expect(canRemoveMember(context)).toBe(true);
    expect(canTransferOwnership(context)).toBe(false);
  });

  it("protects self-management and owner operations", () => {
    expect(
      canRemoveMember({ ...member, targetUserId: member.actorId }),
    ).toBe(false);
    expect(
      canChangeMemberRole({ ...member, targetRole: "owner" }),
    ).toBe(false);
    expect(
      canRemoveMember({
        ...member,
        actorRole: "admin",
        targetRole: "admin",
      }),
    ).toBe(false);
  });
});
