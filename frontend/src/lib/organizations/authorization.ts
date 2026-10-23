import "server-only";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { withUserContext } from "@/db/client";
import { organizationMembers, organizations } from "@/db/schema";
import {
  type OrganizationPermission,
  roleHasPermission,
} from "@/lib/organizations/permissions";

const organizationIdSchema = z.uuid();

export class OrganizationAccessError extends Error {
  constructor() {
    super("You do not have access to this organization.");
    this.name = "OrganizationAccessError";
  }
}

export type AuthorizedOrganization = {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "member";
};

export async function getOrganizationForUser(
  userId: string,
  organizationId: string,
): Promise<AuthorizedOrganization | null> {
  const validatedOrganizationId = organizationIdSchema.safeParse(organizationId);

  if (!validatedOrganizationId.success) {
    return null;
  }

  return withUserContext(userId, async (transaction) => {
    const [membership] = await transaction
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizationMembers.organizationId, organizations.id),
      )
      .where(
        and(
          eq(organizationMembers.organizationId, validatedOrganizationId.data),
          eq(organizationMembers.userId, userId),
        ),
      )
      .limit(1);

    return membership ?? null;
  });
}

export async function requireOrganizationPermission(
  userId: string,
  organizationId: string,
  permission: OrganizationPermission,
) {
  const organization = await getOrganizationForUser(userId, organizationId);

  if (!organization || !roleHasPermission(organization.role, permission)) {
    throw new OrganizationAccessError();
  }

  return organization;
}
