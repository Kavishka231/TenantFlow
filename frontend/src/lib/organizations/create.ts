import "server-only";

import { randomUUID } from "node:crypto";

import { expenseCategories, organizationMembers, organizations, pipelineStages } from "@/db/schema";
import { withUserContext } from "@/db/client";
import type { createOrganizationSchema } from "@/lib/organizations/validation";
import type { z } from "zod";

type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export class OrganizationSlugConflictError extends Error {
  constructor() {
    super("An organization already uses this workspace URL.");
    this.name = "OrganizationSlugConflictError";
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

export async function createOrganizationForUser(
  userId: string,
  input: CreateOrganizationInput,
) {
  const organizationId = randomUUID();

  try {
    await withUserContext(userId, async (transaction) => {
      await transaction.insert(organizations).values({
        id: organizationId,
        name: input.name,
        slug: input.slug,
        createdBy: userId,
      });

      await transaction.insert(organizationMembers).values({
        organizationId,
        userId,
        role: "owner",
      });

      await transaction.insert(pipelineStages).values([
        { organizationId, name: "Lead", color: "#64748B", position: 1, kind: "open" },
        { organizationId, name: "Qualified", color: "#6366F1", position: 2, kind: "open" },
        { organizationId, name: "Proposal", color: "#F59E0B", position: 3, kind: "open" },
        { organizationId, name: "Won", color: "#10B981", position: 4, kind: "won" },
        { organizationId, name: "Lost", color: "#EF4444", position: 5, kind: "lost" },
      ]);

      await transaction.insert(expenseCategories).values([
        { organizationId, name: "Operations", color: "#6366F1" },
        { organizationId, name: "Marketing", color: "#EC4899" },
        { organizationId, name: "Software", color: "#8B5CF6" },
        { organizationId, name: "Travel", color: "#F59E0B" },
        { organizationId, name: "Office", color: "#10B981" },
        { organizationId, name: "Other", color: "#64748B" },
      ]);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new OrganizationSlugConflictError();
    }

    throw error;
  }

  return { id: organizationId, ...input, role: "owner" as const };
}
