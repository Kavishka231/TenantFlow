from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, status

from app.core.errors import ApiError
from app.db.dependencies import RlsSession
from app.organizations.authorization import require_organization_permission
from app.organizations.models import OrganizationPermission, OrganizationSummary
from app.team.delivery import deliver_invitation
from app.team.models import (
    ChangeMemberRoleRequest,
    CreateInvitationRequest,
    InvitationCreatedResponse,
    MembershipMutationResponse,
    TeamResponse,
)
from app.team.service import (
    DuplicateInvitationError,
    change_member_role,
    create_invitation,
    list_pending_invitations,
    list_team_members,
    remove_member,
    revoke_invitation,
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
    members = await list_team_members(session, organization_id)
    invitations = await list_pending_invitations(session, organization_id)
    return TeamResponse(members=members, invitations=invitations)


@router.post(
    "/invitations",
    response_model=InvitationCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
async def invitation_create(
    organization_id: UUID,
    body: CreateInvitationRequest,
    organization: ManageTeam,
    session: RlsSession,
    request: Request,
) -> InvitationCreatedResponse:
    try:
        invitation_id, expires_at, token = await create_invitation(
            session, organization_id, body
        )
        await session.commit()
    except DuplicateInvitationError as error:
        raise ApiError(
            status.HTTP_409_CONFLICT,
            "duplicate_invitation",
            "An active invitation already exists for this email address.",
        ) from error
    delivery = await deliver_invitation(
        request.app.state.settings,
        invitation_id,
        body.email,
        organization.name,
        body.role,
        token,
    )
    return InvitationCreatedResponse(
        id=invitation_id, expires_at=expires_at, delivery=delivery
    )


@router.delete(
    "/invitations/{invitation_id}", response_model=MembershipMutationResponse
)
async def invitation_revoke(
    invitation_id: UUID,
    organization: ManageTeam,
    session: RlsSession,
) -> MembershipMutationResponse:
    del organization
    return mutation_result(await revoke_invitation(session, invitation_id))


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
