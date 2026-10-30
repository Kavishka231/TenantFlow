import "server-only";

import { z } from "zod";

import { backendRequest } from "@/lib/backend/client";
import { createOrganizationForUser } from "@/lib/organizations/create";
import {
  listOrganizationsForUser,
  type OrganizationSummary,
} from "@/lib/organizations/list";
import { updateOrganizationForUser } from "@/lib/organizations/settings";
import type {
  createOrganizationSchema,
  updateOrganizationSchema,
} from "@/lib/organizations/validation";

type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

const organizationListSchema = z.array(
  z.object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    role: z.enum(["owner", "admin", "member"]),
  }),
);

export async function listOrganizationsThroughBackend(
  userId: string,
  accessToken: string | undefined,
): Promise<OrganizationSummary[]> {
  const result = await backendRequest("/api/v1/organizations", accessToken);
  if (!result.enabled) {
    return listOrganizationsForUser(userId);
  }
  return organizationListSchema.parse(result.data);
}

export async function createOrganizationThroughBackend(
  userId: string,
  accessToken: string | undefined,
  input: CreateOrganizationInput,
) {
  const result = await backendRequest("/api/v1/organizations", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!result.enabled) {
    return createOrganizationForUser(userId, input);
  }
  return organizationListSchema.element.parse(result.data);
}

export async function updateOrganizationThroughBackend(
  userId: string,
  accessToken: string | undefined,
  input: UpdateOrganizationInput,
) {
  const result = await backendRequest(
    `/api/v1/organizations/${input.organizationId}`,
    accessToken,
    { method: "PATCH", body: JSON.stringify({ name: input.name }) },
  );
  if (!result.enabled) {
    return updateOrganizationForUser(userId, input);
  }
  return organizationListSchema.element.parse(result.data);
}
