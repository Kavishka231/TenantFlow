import "server-only";

import { randomBytes } from "node:crypto";

import { sql } from "drizzle-orm";
import type { z } from "zod";

import { withUserContext } from "@/db/client";
import { deliverInvitation } from "@/lib/team/delivery";
import type { createInvitationSchema } from "@/lib/team/validation";
import { hashInvitationToken } from "@/lib/team/token";

type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export class DuplicateInvitationError extends Error {
  constructor() {
    super("An active invitation already exists for this email address.");
    this.name = "DuplicateInvitationError";
  }
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export async function createInvitationForUser(
  userId: string,
  organizationName: string,
  input: CreateInvitationInput,
) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashInvitationToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  let invitationId: string;

  try {
    invitationId = await withUserContext(userId, async (transaction) => {
      const result = await transaction.execute<{ invitationId: string }>(sql`
        select public.create_organization_invitation(
          ${input.organizationId}::uuid,
          ${input.email}::text,
          ${input.role}::public.organization_role,
          ${tokenHash}::text,
          ${expiresAt.toISOString()}::timestamptz
        ) as "invitationId"
      `);

      const created = result[0];
      if (!created) {
        throw new Error("The invitation could not be created.");
      }

      return created.invitationId;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DuplicateInvitationError();
    }

    throw error;
  }

  const delivery = await deliverInvitation({
    email: input.email,
    invitationId,
    organizationName,
    role: input.role,
    token,
  }).catch(() => ({ channel: "delivery-error", delivered: false }) as const);

  return { delivery, expiresAt, id: invitationId };
}

export async function revokeInvitationForUser(
  userId: string,
  invitationId: string,
) {
  return withUserContext(userId, async (transaction) => {
    const result = await transaction.execute<{ revoked: boolean }>(sql`
      select public.revoke_organization_invitation(
        ${invitationId}::uuid
      ) as revoked
    `);

    return result[0]?.revoked ?? false;
  });
}
