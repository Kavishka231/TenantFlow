import { describe, expect, it } from "vitest";

import {
  resolveActiveWorkspace,
  workspaceIdSchema,
} from "./workspace-validation";

describe("workspace selection", () => {
  it("accepts UUID workspace identifiers", () => {
    expect(
      workspaceIdSchema.parse("11111111-1111-4111-8111-111111111111"),
    ).toBe("11111111-1111-4111-8111-111111111111");
  });

  it.each(["", "acme", "../../../admin", "11111111-1111-1111-1111"])(
    "rejects invalid workspace identifier %s",
    (organizationId) => {
      expect(workspaceIdSchema.safeParse(organizationId).success).toBe(false);
    },
  );

  it("falls back safely when a persisted workspace is unauthorized", () => {
    const authorized = [
      { id: "11111111-1111-4111-8111-111111111111", name: "Authorized" },
    ];

    expect(
      resolveActiveWorkspace(
        authorized,
        "22222222-2222-4222-8222-222222222222",
      ),
    ).toEqual(authorized[0]);
  });

  it("returns no active workspace for an empty membership list", () => {
    expect(
      resolveActiveWorkspace([], "11111111-1111-4111-8111-111111111111"),
    ).toBeNull();
  });
});
