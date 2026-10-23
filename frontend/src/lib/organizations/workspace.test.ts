import { describe, expect, it } from "vitest";

import { workspaceIdSchema } from "./workspace-validation";

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
});
