import pytest

from app.organizations.models import OrganizationPermission, OrganizationRole
from app.organizations.permissions import role_has_permission


@pytest.mark.parametrize("role", list(OrganizationRole))
def test_all_roles_can_read_workspaces(role: OrganizationRole) -> None:
    assert role_has_permission(role, OrganizationPermission.READ_WORKSPACE)


@pytest.mark.parametrize(
    ("role", "allowed"),
    [
        (OrganizationRole.OWNER, True),
        (OrganizationRole.ADMIN, True),
        (OrganizationRole.MEMBER, False),
    ],
)
def test_expense_management_role_matrix(
    role: OrganizationRole, *, allowed: bool
) -> None:
    assert role_has_permission(role, OrganizationPermission.MANAGE_EXPENSES) is allowed


def test_only_owner_can_manage_billing() -> None:
    assert role_has_permission(OrganizationRole.OWNER, OrganizationPermission.MANAGE_BILLING)
    assert not role_has_permission(
        OrganizationRole.ADMIN, OrganizationPermission.MANAGE_BILLING
    )
    assert not role_has_permission(
        OrganizationRole.MEMBER, OrganizationPermission.MANAGE_BILLING
    )
