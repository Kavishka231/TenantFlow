import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  backendRequest: vi.fn(),
  createOrganizationForUser: vi.fn(),
}));

vi.mock("@/lib/backend/client", () => ({
  backendRequest: mocks.backendRequest,
  BackendApiError: class BackendApiError extends Error {
    constructor(readonly status: number, readonly code: string | undefined) {
      super("Backend request failed");
    }
  },
}));
vi.mock("@/lib/organizations/create", () => ({
  createOrganizationForUser: mocks.createOrganizationForUser,
  OrganizationSlugConflictError: class OrganizationSlugConflictError extends Error {},
}));
vi.mock("@/lib/organizations/list", () => ({ listOrganizationsForUser: vi.fn() }));
vi.mock("@/lib/organizations/settings", () => ({ updateOrganizationForUser: vi.fn() }));

import { BackendApiError } from "./client";
import { createOrganizationThroughBackend } from "./organizations";
import { OrganizationSlugConflictError } from "@/lib/organizations/create";

beforeEach(() => vi.clearAllMocks());

describe("organization FastAPI adapter", () => {
  it("preserves the workspace slug conflict used by the form", async () => {
    mocks.backendRequest.mockRejectedValue(
      new BackendApiError(409, "organization_slug_conflict"),
    );

    await expect(
      createOrganizationThroughBackend("user", "token", {
        name: "Acme",
        slug: "acme",
      }),
    ).rejects.toBeInstanceOf(OrganizationSlugConflictError);
  });
});
