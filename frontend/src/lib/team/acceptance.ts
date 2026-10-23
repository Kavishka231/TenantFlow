import "server-only";

import { sql } from "drizzle-orm";

import { withUserContext } from "@/db/client";
import { hashInvitationToken } from "@/lib/team/invitations";
import { invitationTokenSchema } from "@/lib/team/validation";

export type AcceptedInvitation = {
  organizationId: string;
  organizationName: string;
  role: "admin" | "member";
};

export class InvalidInvitationError extends Error {
  constructor() {
    super(
      "This invitation is invalid, expired, already used, or belongs to another account.",
    );
    this.name = "InvalidInvitationError";
  }
}

export async function acceptInvitationForUser(
  userId: string,
  token: string,
): Promise<AcceptedInvitation> {
  const parsedToken = invitationTokenSchema.safeParse(token);

  if (!parsedToken.success) {
    throw new InvalidInvitationError();
  }

  try {
    return await withUserContext(userId, async (transaction) => {
      const result = await transaction.execute<AcceptedInvitation>(sql`
        select
          organization_id as "organizationId",
          organization_name as "organizationName",
          membership_role as role
        from public.accept_organization_invitation(
          ${hashInvitationToken(parsedToken.data)}::text
        )
      `);

      const accepted = result[0];
      if (!accepted) {
        throw new InvalidInvitationError();
      }

      return accepted;
    });
  } catch (error) {
    if (error instanceof InvalidInvitationError) {
      throw error;
    }

    throw new InvalidInvitationError();
  }
}
