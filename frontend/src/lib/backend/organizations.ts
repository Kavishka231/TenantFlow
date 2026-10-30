import "server-only";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import { getServerEnv } from "@/lib/env/server";
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
  const { FASTAPI_INTERNAL_URL } = getServerEnv();

  if (!FASTAPI_INTERNAL_URL) {
    return listOrganizationsForUser(userId);
  }

  if (!accessToken) {
    throw new Error("An authenticated Supabase session is required.");
  }

  const response = await fetch(
    new URL("/api/v1/organizations", FASTAPI_INTERNAL_URL),
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Request-ID": randomUUID(),
      },
      signal: AbortSignal.timeout(5_000),
    },
  );

  if (!response.ok) {
    throw new Error(`FastAPI organization request failed (${response.status}).`);
  }

  return organizationListSchema.parse(await response.json());
}
