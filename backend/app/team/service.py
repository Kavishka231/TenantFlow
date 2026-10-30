from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.team.models import TeamMember


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
