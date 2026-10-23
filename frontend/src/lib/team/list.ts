import "server-only";

import { and, asc, desc, eq, gt, isNull } from "drizzle-orm";

import { withUserContext } from "@/db/client";
import {
  organizationInvitations,
  organizationMembers,
  profiles,
} from "@/db/schema";

export type TeamMember = {
  fullName: string | null;
  joinedAt: Date;
  role: "owner" | "admin" | "member";
  userId: string;
};

export type PendingInvitation = {
  createdAt: Date;
  email: string;
  expiresAt: Date;
  id: string;
  role: "admin" | "member";
};

export function listOrganizationTeam(userId: string, organizationId: string) {
  return withUserContext(userId, async (transaction) => {
    const [members, invitations] = await Promise.all([
      transaction
        .select({
          fullName: profiles.fullName,
          joinedAt: organizationMembers.joinedAt,
          role: organizationMembers.role,
          userId: organizationMembers.userId,
        })
        .from(organizationMembers)
        .innerJoin(profiles, eq(organizationMembers.userId, profiles.id))
        .where(eq(organizationMembers.organizationId, organizationId))
        .orderBy(asc(profiles.fullName), asc(organizationMembers.userId)),
      transaction
        .select({
          createdAt: organizationInvitations.createdAt,
          email: organizationInvitations.email,
          expiresAt: organizationInvitations.expiresAt,
          id: organizationInvitations.id,
          role: organizationInvitations.role,
        })
        .from(organizationInvitations)
        .where(
          and(
            eq(organizationInvitations.organizationId, organizationId),
            isNull(organizationInvitations.acceptedAt),
            isNull(organizationInvitations.revokedAt),
            gt(organizationInvitations.expiresAt, new Date()),
          ),
        )
        .orderBy(desc(organizationInvitations.createdAt)),
    ]);

    return { invitations, members };
  });
}
