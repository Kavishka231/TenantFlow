from app.organizations.models import OrganizationPermission, OrganizationRole

ALL_PERMISSIONS = frozenset(OrganizationPermission)
ADMIN_PERMISSIONS = frozenset(
    {
        OrganizationPermission.READ_WORKSPACE,
        OrganizationPermission.UPDATE_ORGANIZATION,
        OrganizationPermission.MANAGE_MEMBERS,
        OrganizationPermission.READ_CUSTOMERS,
        OrganizationPermission.MANAGE_CUSTOMERS,
        OrganizationPermission.READ_INVOICES,
        OrganizationPermission.MANAGE_INVOICES,
        OrganizationPermission.READ_ANALYTICS,
        OrganizationPermission.READ_DEALS,
        OrganizationPermission.MANAGE_DEALS,
        OrganizationPermission.READ_EXPENSES,
        OrganizationPermission.MANAGE_EXPENSES,
    }
)
MEMBER_PERMISSIONS = frozenset(
    {
        OrganizationPermission.READ_WORKSPACE,
        OrganizationPermission.READ_CUSTOMERS,
        OrganizationPermission.READ_INVOICES,
        OrganizationPermission.READ_ANALYTICS,
        OrganizationPermission.READ_DEALS,
        OrganizationPermission.READ_EXPENSES,
    }
)

PERMISSIONS_BY_ROLE = {
    OrganizationRole.OWNER: ALL_PERMISSIONS,
    OrganizationRole.ADMIN: ADMIN_PERMISSIONS,
    OrganizationRole.MEMBER: MEMBER_PERMISSIONS,
}


def role_has_permission(
    role: OrganizationRole, permission: OrganizationPermission
) -> bool:
    return permission in PERMISSIONS_BY_ROLE[role]
