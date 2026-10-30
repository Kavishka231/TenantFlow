from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.organizations.models import (
    CreateOrganizationRequest,
    OrganizationRole,
    OrganizationSummary,
    UpdateOrganizationRequest,
)


class OrganizationSlugConflictError(Exception):
    pass


def is_unique_violation(error: IntegrityError) -> bool:
    return getattr(error.orig, "sqlstate", None) == "23505"


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


async def create_organization(
    session: AsyncSession, user_id: UUID, request: CreateOrganizationRequest
) -> OrganizationSummary:
    organization_id = uuid4()
    try:
        await session.execute(
            text(
                """
                insert into public.organizations (id, name, slug, created_by)
                values (:organization_id, :name, :slug, :user_id)
                """
            ),
            {
                "name": request.name,
                "organization_id": str(organization_id),
                "slug": request.slug,
                "user_id": str(user_id),
            },
        )
        await session.execute(
            text(
                """
                insert into public.organization_members (organization_id, user_id, role)
                values (:organization_id, :user_id, 'owner')
                """
            ),
            {"organization_id": str(organization_id), "user_id": str(user_id)},
        )
        await session.execute(
            text(
                """
                insert into public.pipeline_stages
                  (organization_id, name, color, position, kind)
                values
                  (:organization_id, 'Lead', '#64748B', 1, 'open'),
                  (:organization_id, 'Qualified', '#6366F1', 2, 'open'),
                  (:organization_id, 'Proposal', '#F59E0B', 3, 'open'),
                  (:organization_id, 'Won', '#10B981', 4, 'won'),
                  (:organization_id, 'Lost', '#EF4444', 5, 'lost')
                """
            ),
            {"organization_id": str(organization_id)},
        )
        await session.execute(
            text(
                """
                insert into public.expense_categories (organization_id, name, color)
                values
                  (:organization_id, 'Operations', '#6366F1'),
                  (:organization_id, 'Marketing', '#EC4899'),
                  (:organization_id, 'Software', '#8B5CF6'),
                  (:organization_id, 'Travel', '#F59E0B'),
                  (:organization_id, 'Office', '#10B981'),
                  (:organization_id, 'Other', '#64748B')
                """
            ),
            {"organization_id": str(organization_id)},
        )
    except IntegrityError as error:
        if is_unique_violation(error):
            raise OrganizationSlugConflictError from error
        raise

    return OrganizationSummary(
        id=organization_id,
        name=request.name,
        slug=request.slug,
        role=OrganizationRole.OWNER,
    )


async def update_organization(
    session: AsyncSession,
    organization: OrganizationSummary,
    request: UpdateOrganizationRequest,
) -> OrganizationSummary:
    result = await session.execute(
        text(
            """
            update public.organizations
            set name = :name
            where id = :organization_id
            returning id, name, slug
            """
        ),
        {"name": request.name, "organization_id": str(organization.id)},
    )
    row = result.mappings().one_or_none()
    if row is None:
        raise RuntimeError("Authorized organization disappeared during update.")
    return OrganizationSummary(**dict(row), role=organization.role)
