import "server-only";

import { asc, eq } from "drizzle-orm";

import { withUserContext } from "@/db/client";
import { organizationMembers, organizations } from "@/db/schema";

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "member";
};

export function listOrganizationsForUser(
  userId: string,
): Promise<OrganizationSummary[]> {
  return withUserContext(userId, (transaction) =>
    transaction
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
      .where(eq(organizationMembers.userId, userId))
      .orderBy(asc(organizations.name)),
  );
}
