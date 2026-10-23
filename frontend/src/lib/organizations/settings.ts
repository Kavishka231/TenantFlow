import "server-only";

import { eq } from "drizzle-orm";
import type { z } from "zod";

import { withUserContext } from "@/db/client";
import { organizations } from "@/db/schema";
import type { updateOrganizationSchema } from "@/lib/organizations/validation";

type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export function updateOrganizationForUser(
  userId: string,
  input: UpdateOrganizationInput,
) {
  return withUserContext(userId, async (transaction) => {
    const [updated] = await transaction
      .update(organizations)
      .set({ name: input.name })
      .where(eq(organizations.id, input.organizationId))
      .returning({ id: organizations.id, name: organizations.name });

    return updated ?? null;
  });
}
