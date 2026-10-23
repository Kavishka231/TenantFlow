import { z } from "zod";

export const workspaceIdSchema = z.uuid("Select a valid workspace.");

export function resolveActiveWorkspace<T extends { id: string }>(
  organizations: readonly T[],
  selectedId: unknown,
) {
  const validatedId = workspaceIdSchema.safeParse(selectedId);

  if (validatedId.success) {
    const selectedOrganization = organizations.find(
      (organization) => organization.id === validatedId.data,
    );

    if (selectedOrganization) {
      return selectedOrganization;
    }
  }

  return organizations[0] ?? null;
}
