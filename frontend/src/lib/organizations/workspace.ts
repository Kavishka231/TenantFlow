import "server-only";

import { cookies } from "next/headers";

import {
  listOrganizationsForUser,
  type OrganizationSummary,
} from "@/lib/organizations/list";
import {
  resolveActiveWorkspace,
  workspaceIdSchema,
} from "@/lib/organizations/workspace-validation";

export const workspaceCookieName = "tenantflow_workspace";

export async function setSelectedWorkspace(organizationId: string) {
  const validatedOrganizationId = workspaceIdSchema.parse(organizationId);
  const cookieStore = await cookies();

  cookieStore.set(workspaceCookieName, validatedOrganizationId, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function getActiveWorkspaceForUser(
  userId: string,
): Promise<{
  activeOrganization: OrganizationSummary | null;
  organizations: OrganizationSummary[];
}> {
  const organizations = await listOrganizationsForUser(userId);
  const cookieStore = await cookies();
  const activeOrganization = resolveActiveWorkspace(
    organizations,
    cookieStore.get(workspaceCookieName)?.value,
  );

  return {
    activeOrganization,
    organizations,
  };
}
