import "server-only";

import { z } from "zod";

import { backendRequest } from "@/lib/backend/client";
import {
  listOrganizationsForUser,
  type OrganizationSummary,
} from "@/lib/organizations/list";

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
