import { z } from "zod";

export const organizationRoleSchema = z.enum(["owner", "admin", "member"]);
export type OrganizationRole = z.infer<typeof organizationRoleSchema>;

export const organizationPermissions = [
  "read_workspace",
  "update_organization",
  "manage_members",
  "delete_organization",
  "read_customers",
  "manage_customers",
] as const;

export type OrganizationPermission = (typeof organizationPermissions)[number];

const permissionsByRole: Record<
  OrganizationRole,
  ReadonlySet<OrganizationPermission>
> = {
  owner: new Set(organizationPermissions),
  admin: new Set([
    "read_workspace",
    "update_organization",
    "manage_members",
    "read_customers",
    "manage_customers",
  ]),
  member: new Set(["read_workspace", "read_customers"]),
};

export function roleHasPermission(
  role: OrganizationRole,
  permission: OrganizationPermission,
) {
  return permissionsByRole[role].has(permission);
}

export function rolesWithPermission(permission: OrganizationPermission) {
  return organizationRoleSchema.options.filter((role) =>
    roleHasPermission(role, permission),
  );
}
