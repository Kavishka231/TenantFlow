from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.auth.dependencies import CurrentUser
from app.core.errors import ApiError
from app.db.dependencies import RlsSession
from app.organizations.authorization import ReadOrganization, require_organization_permission
from app.organizations.models import (
    CreateOrganizationRequest,
    OrganizationPermission,
    OrganizationSummary,
    UpdateOrganizationRequest,
)
from app.organizations.service import (
    OrganizationSlugConflictError,
    create_organization,
    list_organizations,
    update_organization,
)

router = APIRouter(prefix="/organizations", tags=["organizations"])
UpdateOrganization = require_organization_permission(
    OrganizationPermission.UPDATE_ORGANIZATION
)


@router.get("", response_model=list[OrganizationSummary])
async def organization_list(
    user: CurrentUser, session: RlsSession
) -> list[OrganizationSummary]:
    return await list_organizations(session, user.id)


@router.post("", response_model=OrganizationSummary, status_code=status.HTTP_201_CREATED)
async def organization_create(
    request: CreateOrganizationRequest, user: CurrentUser, session: RlsSession
) -> OrganizationSummary:
    try:
        return await create_organization(session, user.id, request)
    except OrganizationSlugConflictError as error:
        raise ApiError(
            status.HTTP_409_CONFLICT,
            "organization_slug_conflict",
            "An organization already uses this workspace URL.",
        ) from error


@router.get("/{organization_id}", response_model=OrganizationSummary)
async def organization_detail(
    organization_id: UUID, organization: ReadOrganization
) -> OrganizationSummary:
    del organization_id
    return organization


@router.patch("/{organization_id}", response_model=OrganizationSummary)
async def organization_update(
    organization_id: UUID,
    request: UpdateOrganizationRequest,
    session: RlsSession,
    organization: Annotated[OrganizationSummary, Depends(UpdateOrganization)],
) -> OrganizationSummary:
    del organization_id
    return await update_organization(session, organization, request)
