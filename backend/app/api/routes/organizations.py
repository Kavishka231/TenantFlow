from uuid import UUID

from fastapi import APIRouter

from app.auth.dependencies import CurrentUser
from app.db.dependencies import RlsSession
from app.organizations.authorization import ReadOrganization
from app.organizations.models import OrganizationSummary
from app.organizations.service import list_organizations

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("", response_model=list[OrganizationSummary])
async def organization_list(
    user: CurrentUser, session: RlsSession
) -> list[OrganizationSummary]:
    return await list_organizations(session, user.id)


@router.get("/{organization_id}", response_model=OrganizationSummary)
async def organization_detail(
    organization_id: UUID, organization: ReadOrganization
) -> OrganizationSummary:
    del organization_id
    return organization
