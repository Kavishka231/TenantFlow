from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.billing.models import OrganizationSubscription, StripeCustomer, SubscriptionPlan
from app.billing.schemas import BillingResponse, PlanResponse, SubscriptionResponse

ACTIVE_SUBSCRIPTION_STATUSES = {"active", "trialing", "past_due"}


async def list_plans(session: AsyncSession) -> list[PlanResponse]:
    plans = (
        await session.execute(
            select(SubscriptionPlan)
            .where(SubscriptionPlan.active.is_(True))
            .order_by(SubscriptionPlan.sort_order)
        )
    ).scalars()
    return [PlanResponse.model_validate(plan) for plan in plans]


async def get_billing(session: AsyncSession, organization_id: UUID) -> BillingResponse:
    customer_id = await session.scalar(
        select(StripeCustomer.stripe_customer_id).where(
            StripeCustomer.organization_id == organization_id
        )
    )
    row = (
        (
            await session.execute(
                text("""
        select s.status, s.cancel_at_period_end, s.current_period_end,
               p.key plan_key, p.name plan_name
        from public.organization_subscriptions s join public.subscription_plans p on p.id=s.plan_id
        where s.organization_id=:organization_id
    """),
                {"organization_id": organization_id},
            )
        )
        .mappings()
        .one_or_none()
    )
    return BillingResponse(
        customer_id=customer_id,
        subscription=SubscriptionResponse.model_validate(dict(row)) if row else None,
    )


async def register_customer(
    session: AsyncSession, organization_id: UUID, stripe_customer_id: str
) -> None:
    await session.execute(
        text("select public.register_stripe_customer(:organization_id, :customer_id)"),
        {
            "organization_id": organization_id,
            "customer_id": stripe_customer_id,
        },
    )


async def has_active_subscription(session: AsyncSession, organization_id: UUID) -> bool:
    status = await session.scalar(
        select(OrganizationSubscription.status).where(
            OrganizationSubscription.organization_id == organization_id
        )
    )
    return status is not None and status.value in ACTIVE_SUBSCRIPTION_STATUSES
