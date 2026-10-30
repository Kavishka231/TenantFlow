import "server-only";

import { z } from "zod";

import { backendRequest } from "@/lib/backend/client";
import { listOrganizationTeam } from "@/lib/team/list";

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
