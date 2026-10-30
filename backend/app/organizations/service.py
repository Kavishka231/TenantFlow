from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.organizations.models import OrganizationSummary


async def list_organizations(
    session: AsyncSession, user_id: UUID
) -> list[OrganizationSummary]:
    result = await session.execute(
        text(
            """
            select organization.id, organization.name, organization.slug,
                   membership.role::text as role
            from public.organization_members membership
            join public.organizations organization
              on organization.id = membership.organization_id
            where membership.user_id = :user_id
            order by organization.name asc, organization.id asc
            """
        ),
        {"user_id": str(user_id)},
    )
    return [OrganizationSummary.model_validate(dict(row)) for row in result.mappings()]


async def get_organization(
    session: AsyncSession, user_id: UUID, organization_id: UUID
) -> OrganizationSummary | None:
    result = await session.execute(
        text(
            """
            select organization.id, organization.name, organization.slug,
                   membership.role::text as role
            from public.organization_members membership
            join public.organizations organization
              on organization.id = membership.organization_id
            where membership.user_id = :user_id
              and membership.organization_id = :organization_id
            limit 1
            """
        ),
        {"organization_id": str(organization_id), "user_id": str(user_id)},
    )
    row = result.mappings().one_or_none()
    return OrganizationSummary.model_validate(dict(row)) if row else None
