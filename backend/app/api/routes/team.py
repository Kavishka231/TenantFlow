from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, status

from app.auth.dependencies import CurrentUser
from app.core.errors import ApiError
from app.db.dependencies import RlsSession, SessionFactory
from app.db.session import rls_transaction
from app.organizations.authorization import require_organization_permission
from app.organizations.models import OrganizationPermission, OrganizationSummary
from app.organizations.permissions import role_has_permission
from app.organizations.service import get_organization
from app.team.audit import AuditEvent, list_audit_events
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


@router.get("/audit", response_model=list[AuditEvent])
async def audit_list(
    organization_id: UUID,
    organization: ManageTeam,
    session: RlsSession,
    limit: int = 50,
) -> list[AuditEvent]:
    del organization
    return await list_audit_events(session, organization_id, limit)


@router.post(
    "/invitations",
    response_model=InvitationCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
async def invitation_create(
    organization_id: UUID,
    body: CreateInvitationRequest,
    user: CurrentUser,
    session_factory: SessionFactory,
    request: Request,
) -> InvitationCreatedResponse:
    try:
        async with rls_transaction(session_factory, user.id) as session:
            organization = await get_organization(session, user.id, organization_id)
            if organization is None or not role_has_permission(
                organization.role, OrganizationPermission.MANAGE_MEMBERS
            ):
                raise ApiError(
                    status.HTTP_404_NOT_FOUND,
                    "organization_not_found",
                    "The organization was not found.",
                )
            invitation_id, expires_at, token = await create_invitation(
                session, organization_id, body
            )
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
