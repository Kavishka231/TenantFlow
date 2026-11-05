import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ backendRequest: vi.fn() }));

vi.mock("@/lib/backend/client", () => ({
  backendRequest: mocks.backendRequest,
  BackendApiError: class BackendApiError extends Error {
    constructor(readonly status: number, readonly code: string | undefined) {
      super("Backend request failed");
    }
  },
}));
vi.mock("@/lib/team/acceptance", () => ({
  acceptInvitationForUser: vi.fn(),
  InvalidInvitationError: class InvalidInvitationError extends Error {},
}));
vi.mock("@/lib/team/invitations", () => ({
  createInvitationForUser: vi.fn(),
  DuplicateInvitationError: class DuplicateInvitationError extends Error {},
  revokeInvitationForUser: vi.fn(),
}));
vi.mock("@/lib/team/list", () => ({ listOrganizationTeam: vi.fn() }));
vi.mock("@/lib/team/members", () => ({
  changeMemberRoleForUser: vi.fn(),
  removeMemberForUser: vi.fn(),
  transferOwnershipForUser: vi.fn(),
}));

import { BackendApiError } from "./client";
import {
  acceptInvitationThroughBackend,
  changeMemberRoleThroughBackend,
  createInvitationThroughBackend,
} from "./team";
import { InvalidInvitationError } from "@/lib/team/acceptance";
import { DuplicateInvitationError } from "@/lib/team/invitations";

const organizationId = "10000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000001";

beforeEach(() => vi.clearAllMocks());

describe("team FastAPI adapter", () => {
  it("preserves duplicate invitation feedback", async () => {
    mocks.backendRequest.mockRejectedValue(
      new BackendApiError(409, "duplicate_invitation"),
    );
    await expect(
      createInvitationThroughBackend(userId, "token", "Acme", {
        organizationId,
        email: "member@example.com",
        role: "member",
      }),
    ).rejects.toBeInstanceOf(DuplicateInvitationError);
  });

  it("preserves rejected membership mutations as a false result", async () => {
    mocks.backendRequest.mockRejectedValue(
      new BackendApiError(409, "membership_change_rejected"),
    );
    await expect(
      changeMemberRoleThroughBackend(userId, "token", {
        organizationId,
        userId,
        role: "admin",
      }),
    ).resolves.toBe(false);
  });

  it("preserves invalid invitation feedback", async () => {
    mocks.backendRequest.mockRejectedValue(
      new BackendApiError(400, "invalid_invitation"),
    );
    await expect(
      acceptInvitationThroughBackend(userId, "token", "a".repeat(43)),
    ).rejects.toBeInstanceOf(InvalidInvitationError);
  });
});
