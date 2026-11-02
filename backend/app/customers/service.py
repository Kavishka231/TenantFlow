from uuid import UUID

from sqlalchemy import asc, delete, desc, func, or_, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.customers.models import Customer, CustomerStatus
from app.customers.schemas import (
    CreateCustomerRequest,
    CustomerListResponse,
    CustomerSort,
    UpdateCustomerRequest,
)


class CustomerConflictError(Exception):
    pass


class CustomerPlanLimitError(Exception):
    pass


def escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


async def list_customers(
    session: AsyncSession,
    organization_id: UUID,
    *,
    page: int,
    page_size: int,
    query: str,
    sort: CustomerSort,
    status: CustomerStatus | None,
) -> CustomerListResponse:
    conditions = [Customer.organization_id == organization_id]
    if status is not None:
        conditions.append(Customer.status == status)
    if query:
        pattern = f"%{escape_like(query.lower())}%"
        conditions.append(
            or_(
                func.lower(Customer.name).like(pattern, escape="\\"),
                func.lower(func.coalesce(Customer.email, "")).like(
                    pattern, escape="\\"
                ),
                func.lower(func.coalesce(Customer.phone, "")).like(
                    pattern, escape="\\"
                ),
                func.lower(func.coalesce(Customer.company, "")).like(
                    pattern, escape="\\"
                ),
            )
        )

    ordering = {
        CustomerSort.NAME_ASC: (asc(Customer.name), asc(Customer.id)),
        CustomerSort.NAME_DESC: (desc(Customer.name), desc(Customer.id)),
        CustomerSort.NEWEST: (desc(Customer.created_at), desc(Customer.id)),
        CustomerSort.OLDEST: (asc(Customer.created_at), asc(Customer.id)),
        CustomerSort.RECENTLY_UPDATED: (
            desc(Customer.updated_at),
            desc(Customer.id),
        ),
    }[sort]
    rows_result = await session.execute(
        select(Customer)
        .where(*conditions)
        .order_by(*ordering)
        .limit(page_size)
        .offset((page - 1) * page_size)
    )
    total = int(
        await session.scalar(
            select(func.count()).select_from(Customer).where(*conditions)
        )
        or 0
    )
    return CustomerListResponse(
        customers=list(rows_result.scalars().all()),
        page=page,
        page_count=max(1, (total + page_size - 1) // page_size),
        page_size=page_size,
        total=total,
    )


async def get_customer(
    session: AsyncSession, organization_id: UUID, customer_id: UUID
) -> Customer | None:
    result = await session.execute(
        select(Customer).where(
            Customer.organization_id == organization_id,
            Customer.id == customer_id,
        )
    )
    return result.scalar_one_or_none()


async def assert_customer_capacity(
    session: AsyncSession, organization_id: UUID
) -> None:
    await session.execute(
        text("select pg_advisory_xact_lock(hashtextextended(:organization_id, 7281))"),
        {"organization_id": str(organization_id)},
    )
    entitlement_result = await session.execute(
        text(
            """
            select plan_key, max_customers
            from public.get_organization_entitlements(:organization_id)
            """
        ),
        {"organization_id": str(organization_id)},
    )
    entitlement = entitlement_result.mappings().one_or_none()
    if entitlement is None:
        raise CustomerPlanLimitError
    maximum = entitlement["max_customers"]
    if maximum is None:
        return
    usage = await session.scalar(
        select(func.count()).select_from(Customer).where(
            Customer.organization_id == organization_id
        )
    )
    if int(usage or 0) >= int(maximum):
        raise CustomerPlanLimitError


async def create_customer(
    session: AsyncSession,
    organization_id: UUID,
    user_id: UUID,
    request: CreateCustomerRequest,
) -> Customer:
    await assert_customer_capacity(session, organization_id)
    customer = Customer(
        organization_id=organization_id,
        created_by=user_id,
        updated_by=user_id,
        **request.model_dump(),
    )
    session.add(customer)
    await session.flush()
    await session.refresh(customer)
    return customer


async def update_customer(
    session: AsyncSession,
    organization_id: UUID,
    customer_id: UUID,
    user_id: UUID,
    request: UpdateCustomerRequest,
) -> Customer:
    values = request.model_dump(exclude={"version"})
    values["updated_by"] = user_id
    result = await session.execute(
        update(Customer)
        .where(
            Customer.organization_id == organization_id,
            Customer.id == customer_id,
            Customer.version == request.version,
        )
        .values(**values)
        .returning(Customer)
    )
    customer = result.scalar_one_or_none()
    if customer is None:
        raise CustomerConflictError
    return customer


async def delete_customer(
    session: AsyncSession,
    organization_id: UUID,
    customer_id: UUID,
    version: int,
) -> UUID:
    result = await session.execute(
        delete(Customer)
        .where(
            Customer.organization_id == organization_id,
            Customer.id == customer_id,
            Customer.version == version,
        )
        .returning(Customer.id)
    )
    deleted_id = result.scalar_one_or_none()
    if deleted_id is None:
        raise CustomerConflictError
    return deleted_id
