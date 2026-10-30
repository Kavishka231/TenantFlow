import "server-only";

import { z } from "zod";

import { backendRequest } from "@/lib/backend/client";
import { acceptInvitationForUser } from "@/lib/team/acceptance";
import { createInvitationForUser, revokeInvitationForUser } from "@/lib/team/invitations";
import { listOrganizationTeam } from "@/lib/team/list";
import {
  changeMemberRoleForUser,
  removeMemberForUser,
  transferOwnershipForUser,
} from "@/lib/team/members";

const teamSchema = z.object({
  members: z.array(
    z.object({
      user_id: z.uuid(),
      full_name: z.string().nullable(),
      role: z.enum(["owner", "admin", "member"]),
      joined_at: z.coerce.date(),
    }),
  ),
  invitations: z.array(
    z.object({
      id: z.uuid(),
      email: z.string(),
      role: z.enum(["admin", "member"]),
      expires_at: z.coerce.date(),
      created_at: z.coerce.date(),
    }),
  ),
});
const mutationSchema = z.object({ changed: z.boolean() });
const invitationCreatedSchema = z.object({
  id: z.uuid(),
  expires_at: z.coerce.date(),
  delivery: z.object({
    channel: z.enum(["webhook", "development-outbox", "unconfigured", "delivery-error"]),
    delivered: z.boolean(),
  }),
});
const acceptedInvitationSchema = z.object({
  organization_id: z.uuid(),
  organization_name: z.string(),
  role: z.enum(["admin", "member"]),
});

export async function listTeamThroughBackend(
  userId: string,
  accessToken: string | undefined,
  organizationId: string,
) {
  const result = await backendRequest(
    `/api/v1/organizations/${organizationId}/team`,
    accessToken,
  );
  if (!result.enabled) {
    return listOrganizationTeam(userId, organizationId);
  }
  const parsed = teamSchema.parse(result.data);
  return {
    members: parsed.members.map((member) => ({
      fullName: member.full_name,
      joinedAt: member.joined_at,
      role: member.role,
      userId: member.user_id,
    })),
    invitations: parsed.invitations.map((invitation) => ({
      createdAt: invitation.created_at,
      email: invitation.email,
      expiresAt: invitation.expires_at,
      id: invitation.id,
      role: invitation.role,
    })),
  };
}

export async function createInvitationThroughBackend(
  userId: string,
  accessToken: string | undefined,
  organizationName: string,
  input: { organizationId: string; email: string; role: "admin" | "member" },
) {
  const result = await backendRequest(
    `/api/v1/organizations/${input.organizationId}/team/invitations`,
    accessToken,
    { method: "POST", body: JSON.stringify({ email: input.email, role: input.role }) },
  );
  if (!result.enabled) {
    return createInvitationForUser(userId, organizationName, input);
  }
  const parsed = invitationCreatedSchema.parse(result.data);
  return { delivery: parsed.delivery, expiresAt: parsed.expires_at, id: parsed.id };
}

export async function revokeInvitationThroughBackend(
  userId: string,
  accessToken: string | undefined,
  organizationId: string,
  invitationId: string,
) {
  const result = await backendRequest(
    `/api/v1/organizations/${organizationId}/team/invitations/${invitationId}`,
    accessToken,
    { method: "DELETE" },
  );
  if (!result.enabled) return revokeInvitationForUser(userId, invitationId);
  return mutationSchema.parse(result.data).changed;
}

export async function changeMemberRoleThroughBackend(
  userId: string,
  accessToken: string | undefined,
  input: { organizationId: string; userId: string; role: "admin" | "member" },
) {
  const result = await backendRequest(
    `/api/v1/organizations/${input.organizationId}/team/members/${input.userId}/role`,
    accessToken,
    { method: "PATCH", body: JSON.stringify({ role: input.role }) },
  );
  if (!result.enabled) return changeMemberRoleForUser(userId, input);
  return mutationSchema.parse(result.data).changed;
}

export async function removeMemberThroughBackend(
  userId: string,
  accessToken: string | undefined,
  input: { organizationId: string; userId: string },
) {
  const result = await backendRequest(
    `/api/v1/organizations/${input.organizationId}/team/members/${input.userId}`,
    accessToken,
    { method: "DELETE" },
  );
  if (!result.enabled) return removeMemberForUser(userId, input);
  return mutationSchema.parse(result.data).changed;
}

export async function transferOwnershipThroughBackend(
  userId: string,
  accessToken: string | undefined,
  input: { organizationId: string; userId: string },
) {
  const result = await backendRequest(
    `/api/v1/organizations/${input.organizationId}/team/members/${input.userId}/transfer-ownership`,
    accessToken,
    { method: "POST" },
  );
  if (!result.enabled) return transferOwnershipForUser(userId, input);
  return mutationSchema.parse(result.data).changed;
}

export async function acceptInvitationThroughBackend(
  userId: string,
  accessToken: string | undefined,
  token: string,
) {
  const result = await backendRequest("/api/v1/invitations/accept", accessToken, {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  if (!result.enabled) return acceptInvitationForUser(userId, token);
  const parsed = acceptedInvitationSchema.parse(result.data);
  return {
    organizationId: parsed.organization_id,
    organizationName: parsed.organization_name,
    role: parsed.role,
  };
}
