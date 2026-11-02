from uuid import UUID

from sqlalchemy import delete, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.customers.models import Customer
from app.customers.schemas import CreateCustomerRequest, UpdateCustomerRequest


class CustomerConflictError(Exception):
    pass


class CustomerPlanLimitError(Exception):
    pass


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
