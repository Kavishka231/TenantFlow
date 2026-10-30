from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.core.errors import ApiError
from app.db.dependencies import RlsSession
from app.organizations.authorization import require_organization_permission
from app.organizations.models import OrganizationPermission, OrganizationSummary
from app.team.models import (
    ChangeMemberRoleRequest,
    MembershipMutationResponse,
    TeamResponse,
)
from app.team.service import (
    change_member_role,
    list_team_members,
    remove_member,
    transfer_ownership,
)

router = APIRouter(prefix="/organizations/{organization_id}/team", tags=["team"])
ManageTeam = Annotated[
    OrganizationSummary,
    Depends(require_organization_permission(OrganizationPermission.MANAGE_MEMBERS)),
]
ManageOwnership = Annotated[
    OrganizationSummary,
    Depends(require_organization_permission(OrganizationPermission.MANAGE_OWNERSHIP)),
]


def mutation_result(changed: bool) -> MembershipMutationResponse:
    if not changed:
        raise ApiError(
            status.HTTP_409_CONFLICT,
            "membership_change_rejected",
            "The membership change is not permitted.",
        )
    return MembershipMutationResponse(changed=True)


@router.get("", response_model=TeamResponse)
async def team_list(
    organization_id: UUID, organization: ManageTeam, session: RlsSession
) -> TeamResponse:
    del organization
    return TeamResponse(members=await list_team_members(session, organization_id))


@router.patch("/members/{user_id}/role", response_model=MembershipMutationResponse)
async def member_role_update(
    organization_id: UUID,
    user_id: UUID,
    request: ChangeMemberRoleRequest,
    organization: ManageOwnership,
    session: RlsSession,
) -> MembershipMutationResponse:
    del organization
    return mutation_result(
        await change_member_role(session, organization_id, user_id, request.role)
    )


@router.delete("/members/{user_id}", response_model=MembershipMutationResponse)
async def member_remove(
    organization_id: UUID,
    user_id: UUID,
    organization: ManageTeam,
    session: RlsSession,
) -> MembershipMutationResponse:
    del organization
    return mutation_result(await remove_member(session, organization_id, user_id))


@router.post(
    "/members/{user_id}/transfer-ownership", response_model=MembershipMutationResponse
)
async def ownership_transfer(
    organization_id: UUID,
    user_id: UUID,
    organization: ManageOwnership,
    session: RlsSession,
) -> MembershipMutationResponse:
    del organization
    return mutation_result(await transfer_ownership(session, organization_id, user_id))
