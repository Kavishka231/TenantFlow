from uuid import UUID

import httpx

from app.core.config import Settings


class StripeConfigurationError(Exception):
    pass


class StripeApiError(Exception):
    pass


def require_stripe(settings: Settings) -> tuple[str, str, str]:
    if (
        not settings.stripe_secret_key
        or not settings.stripe_starter_price_id
        or not settings.stripe_growth_price_id
    ):
        raise StripeConfigurationError("Stripe Test Mode is not configured.")
    return (
        settings.stripe_secret_key,
        settings.stripe_starter_price_id,
        settings.stripe_growth_price_id,
    )


def price_for_plan(settings: Settings, plan_key: str) -> str:
    _, starter, growth = require_stripe(settings)
    return starter if plan_key == "starter" else growth


def plan_for_price(settings: Settings, price_id: str) -> str | None:
    _, starter, growth = require_stripe(settings)
    return "starter" if price_id == starter else "growth" if price_id == growth else None


async def stripe_post(
    settings: Settings, path: str, body: dict[str, str], *, idempotency_key: str | None = None
) -> dict[str, object]:
    secret, _, _ = require_stripe(settings)
    headers = {"Authorization": f"Bearer {secret}"}
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            f"https://api.stripe.com/v1/{path}", data=body, headers=headers
        )
    data = response.json()
    if not response.is_success or not isinstance(data, dict) or data.get("livemode") is True:
        raise StripeApiError("Stripe could not process the billing request.")
    return data


async def create_customer(settings: Settings, organization_id: UUID, name: str) -> str:
    data = await stripe_post(
        settings,
        "customers",
        {
            "name": name,
            "metadata[tenantflowOrganizationId]": str(organization_id),
        },
        idempotency_key=f"tenantflow-customer-{organization_id}",
    )
    customer_id = data.get("id")
    if not isinstance(customer_id, str) or not customer_id.startswith("cus_"):
        raise StripeApiError("Stripe returned an invalid customer.")
    return customer_id


async def create_checkout(
    settings: Settings, organization_id: UUID, customer_id: str, plan_key: str
) -> str:
    billing_url = (
        f"{str(settings.frontend_app_url).rstrip('/')}/organizations/{organization_id}/billing"
    )
    data = await stripe_post(
        settings,
        "checkout/sessions",
        {
            "mode": "subscription",
            "customer": customer_id,
            "client_reference_id": str(organization_id),
            "line_items[0][price]": price_for_plan(settings, plan_key),
            "line_items[0][quantity]": "1",
            "success_url": f"{billing_url}?checkout=success",
            "cancel_url": f"{billing_url}?checkout=cancelled",
            "metadata[tenantflowOrganizationId]": str(organization_id),
            "metadata[tenantflowPlanKey]": plan_key,
            "subscription_data[metadata][tenantflowOrganizationId]": str(organization_id),
        },
        idempotency_key=f"tenantflow-checkout-{organization_id}-{plan_key}",
    )
    url = data.get("url")
    if not isinstance(url, str) or not url.startswith("https://checkout.stripe.com/"):
        raise StripeApiError("Stripe returned an invalid Checkout URL.")
    return url


async def create_portal(settings: Settings, organization_id: UUID, customer_id: str) -> str:
    return_url = (
        f"{str(settings.frontend_app_url).rstrip('/')}/organizations/{organization_id}/billing"
    )
    data = await stripe_post(
        settings,
        "billing_portal/sessions",
        {
            "customer": customer_id,
            "return_url": return_url,
        },
    )
    url = data.get("url")
    if not isinstance(url, str) or not url.startswith("https://billing.stripe.com/"):
        raise StripeApiError("Stripe returned an invalid Customer Portal URL.")
    return url
