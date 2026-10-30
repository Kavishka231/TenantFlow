from datetime import UTC, datetime, timedelta
from hashlib import sha256
from secrets import token_urlsafe
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.team.models import (
    AcceptedInvitationResponse,
    CreateInvitationRequest,
    PendingInvitation,
    TeamMember,
)


class DuplicateInvitationError(Exception):
    pass


class InvalidInvitationError(Exception):
    pass


async def list_team_members(
    session: AsyncSession, organization_id: UUID
) -> list[TeamMember]:
    result = await session.execute(
        text(
            """
            select membership.user_id, profile.full_name,
                   membership.role::text as role, membership.joined_at
            from public.organization_members membership
            join public.profiles profile on profile.id = membership.user_id
            where membership.organization_id = :organization_id
            order by profile.full_name asc nulls last, membership.user_id asc
            """
        ),
        {"organization_id": str(organization_id)},
    )
    return [TeamMember.model_validate(dict(row)) for row in result.mappings()]


async def list_pending_invitations(
    session: AsyncSession, organization_id: UUID
) -> list[PendingInvitation]:
    result = await session.execute(
        text(
            """
            select id, email, role::text as role, expires_at, created_at
            from public.organization_invitations
            where organization_id = :organization_id
              and accepted_at is null and revoked_at is null and expires_at > now()
            order by created_at desc
            """
        ),
        {"organization_id": str(organization_id)},
    )
    return [PendingInvitation.model_validate(dict(row)) for row in result.mappings()]


async def create_invitation(
    session: AsyncSession, organization_id: UUID, request: CreateInvitationRequest
) -> tuple[UUID, datetime, str]:
    token = token_urlsafe(32)
    token_hash = sha256(token.encode()).hexdigest()
    expires_at = datetime.now(UTC) + timedelta(days=7)
    try:
        result = await session.execute(
            text(
                """
                select public.create_organization_invitation(
                  :organization_id, :email,
                  cast(:role as public.organization_role), :token_hash, :expires_at
                ) as invitation_id
                """
            ),
            {
                "email": request.email,
                "expires_at": expires_at,
                "organization_id": str(organization_id),
                "role": request.role,
                "token_hash": token_hash,
            },
        )
    except IntegrityError as error:
        if getattr(error.orig, "sqlstate", None) == "23505":
            raise DuplicateInvitationError from error
        raise
    return UUID(str(result.scalar_one())), expires_at, token


async def revoke_invitation(session: AsyncSession, invitation_id: UUID) -> bool:
    result = await session.execute(
        text(
            "select public.revoke_organization_invitation(:invitation_id) as revoked"
        ),
        {"invitation_id": str(invitation_id)},
    )
    return bool(result.scalar_one())


async def accept_invitation(
    session: AsyncSession, token: str
) -> AcceptedInvitationResponse:
    token_hash = sha256(token.encode()).hexdigest()
    try:
        result = await session.execute(
            text(
                """
                select organization_id, organization_name,
                       membership_role::text as role
                from public.accept_organization_invitation(:token_hash)
                """
            ),
            {"token_hash": token_hash},
        )
        row = result.mappings().one_or_none()
    except Exception as error:
        raise InvalidInvitationError from error
    if row is None:
        raise InvalidInvitationError
    return AcceptedInvitationResponse.model_validate(dict(row))


async def change_member_role(
    session: AsyncSession,
    organization_id: UUID,
    user_id: UUID,
    role: str,
) -> bool:
    result = await session.execute(
        text(
            """
            select public.change_organization_member_role(
              :organization_id, :user_id, cast(:role as public.organization_role)
            ) as changed
            """
        ),
        {
            "organization_id": str(organization_id),
            "role": role,
            "user_id": str(user_id),
        },
    )
    return bool(result.scalar_one())


async def remove_member(
    session: AsyncSession, organization_id: UUID, user_id: UUID
) -> bool:
    result = await session.execute(
        text(
            """
            select public.remove_organization_member(
              :organization_id, :user_id
            ) as changed
            """
        ),
        {"organization_id": str(organization_id), "user_id": str(user_id)},
    )
    return bool(result.scalar_one())


async def transfer_ownership(
    session: AsyncSession, organization_id: UUID, user_id: UUID
) -> bool:
    result = await session.execute(
        text(
            """
            select public.transfer_organization_ownership(
              :organization_id, :user_id
            ) as changed
            """
        ),
        {"organization_id": str(organization_id), "user_id": str(user_id)},
    )
    return bool(result.scalar_one())
