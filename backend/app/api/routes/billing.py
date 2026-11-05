import json
from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request

from app.billing.analytics import dashboard_analytics
from app.billing.schemas import (
    BillingResponse,
    BillingUrlResponse,
    CheckoutRequest,
    DashboardAnalyticsResponse,
    PlanResponse,
    WebhookResponse,
)
from app.billing.service import (
    get_billing,
    has_active_subscription,
    list_plans,
    register_customer,
)
from app.billing.stripe import (
    StripeApiError,
    StripeConfigurationError,
    create_checkout,
    create_customer,
    create_portal,
)
from app.billing.webhook import SUPPORTED_EVENTS, process_webhook, verify_signature
from app.core.config import Settings, get_app_settings
from app.core.errors import ApiError
from app.db.dependencies import RlsSession
from app.organizations.authorization import require_organization_permission
from app.organizations.models import OrganizationPermission, OrganizationSummary

router = APIRouter(tags=["billing"])
ManageBilling = Annotated[
    OrganizationSummary,
    Depends(require_organization_permission(OrganizationPermission.MANAGE_BILLING)),
]
ReadAnalytics = Annotated[
    OrganizationSummary,
    Depends(require_organization_permission(OrganizationPermission.READ_ANALYTICS)),
]


def stripe_error(error: Exception) -> ApiError:
    status = 503 if isinstance(error, StripeConfigurationError) else 502
    code = "stripe_not_configured" if status == 503 else "stripe_request_failed"
    return ApiError(status, code, str(error))


@router.get("/organizations/{organization_id}/billing/plans", response_model=list[PlanResponse])
async def plans(
    organization_id: UUID, organization: ManageBilling, session: RlsSession
) -> list[PlanResponse]:
    del organization_id, organization
    return await list_plans(session)


@router.get("/organizations/{organization_id}/billing", response_model=BillingResponse)
async def billing(
    organization_id: UUID, organization: ManageBilling, session: RlsSession
) -> BillingResponse:
    del organization
    return await get_billing(session, organization_id)


@router.post("/organizations/{organization_id}/billing/checkout", response_model=BillingUrlResponse)
async def checkout(
    organization_id: UUID,
    request: CheckoutRequest,
    organization: ManageBilling,
    session: RlsSession,
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> BillingUrlResponse:
    if await has_active_subscription(session, organization_id):
        raise ApiError(
            409, "already_subscribed", "This workspace already has an active subscription."
        )
    billing_state = await get_billing(session, organization_id)
    customer_id = billing_state.customer_id
    try:
        if customer_id is None:
            customer_id = await create_customer(settings, organization_id, organization.name)
            await register_customer(session, organization_id, customer_id)
        url = await create_checkout(settings, organization_id, customer_id, request.plan_key)
    except (StripeApiError, StripeConfigurationError) as error:
        raise stripe_error(error) from error
    return BillingUrlResponse(url=url)


@router.post("/organizations/{organization_id}/billing/portal", response_model=BillingUrlResponse)
async def portal(
    organization_id: UUID,
    organization: ManageBilling,
    session: RlsSession,
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> BillingUrlResponse:
    del organization
    customer_id = (await get_billing(session, organization_id)).customer_id
    if customer_id is None:
        raise ApiError(409, "billing_customer_missing", "This workspace has no Stripe customer.")
    try:
        url = await create_portal(settings, organization_id, customer_id)
    except (StripeApiError, StripeConfigurationError) as error:
        raise stripe_error(error) from error
    return BillingUrlResponse(url=url)


@router.get(
    "/organizations/{organization_id}/analytics/dashboard",
    response_model=DashboardAnalyticsResponse,
)
async def analytics(
    organization_id: UUID,
    organization: ReadAnalytics,
    session: RlsSession,
    start: date,
    end_exclusive: date,
) -> DashboardAnalyticsResponse:
    del organization
    if end_exclusive <= start or (end_exclusive - start).days > 367:
        raise ApiError(
            422, "invalid_date_range", "The date range must contain between 1 and 367 days."
        )
    return await dashboard_analytics(session, organization_id, start, end_exclusive)


@router.post("/stripe/webhook", response_model=WebhookResponse)
async def stripe_webhook(
    request: Request,
    settings: Annotated[Settings, Depends(get_app_settings)],
    stripe_signature: Annotated[str | None, Header(alias="stripe-signature")] = None,
) -> WebhookResponse:
    if settings.stripe_webhook_processor != "python":
        raise ApiError(
            503, "webhook_processor_inactive", "Python Stripe webhook processing is inactive."
        )
    payload = await request.body()
    if (
        not stripe_signature
        or not settings.stripe_webhook_secret
        or not verify_signature(payload, stripe_signature, settings.stripe_webhook_secret)
    ):
        raise ApiError(400, "invalid_stripe_signature", "The Stripe signature is invalid.")
    try:
        envelope = json.loads(payload)
        if not isinstance(envelope, dict) or envelope.get("type") not in SUPPORTED_EVENTS:
            return WebhookResponse(processed=False)
        return WebhookResponse(processed=await process_webhook(settings, payload))
    except (ValueError, TypeError, json.JSONDecodeError) as error:
        raise ApiError(400, "invalid_stripe_event", "Webhook processing failed.") from error
