from collections.abc import Awaitable, Callable
from typing import Annotated
from uuid import UUID

from fastapi import Depends

from app.auth.dependencies import CurrentUser
from app.core.errors import ApiError
from app.db.dependencies import RlsSession
from app.organizations.models import OrganizationPermission, OrganizationSummary
from app.organizations.permissions import role_has_permission
from app.organizations.service import get_organization

OrganizationDependency = Callable[..., Awaitable[OrganizationSummary]]


def require_organization_permission(
    permission: OrganizationPermission,
) -> OrganizationDependency:
    async def authorize(
        organization_id: UUID,
        user: CurrentUser,
        session: RlsSession,
    ) -> OrganizationSummary:
        organization = await get_organization(session, user.id, organization_id)
        if organization is None or not role_has_permission(organization.role, permission):
            raise ApiError(404, "organization_not_found", "The organization was not found.")
        return organization

    return authorize


ReadOrganization = Annotated[
    OrganizationSummary,
    Depends(require_organization_permission(OrganizationPermission.READ_WORKSPACE)),
]
