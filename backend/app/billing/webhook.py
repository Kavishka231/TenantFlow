import hashlib
import hmac
import json
import time
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

import psycopg
from pydantic import BaseModel, ConfigDict, Field

from app.billing.models import SubscriptionStatus
from app.billing.stripe import plan_for_price
from app.core.config import Settings

SUPPORTED_EVENTS = {
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "customer.subscription.paused",
    "customer.subscription.resumed",
}


class Price(BaseModel):
    id: str = Field(pattern=r"^price_[A-Za-z0-9]+$")


class Item(BaseModel):
    price: Price


class SubscriptionObject(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(pattern=r"^sub_[A-Za-z0-9]+$")
    customer: str = Field(pattern=r"^cus_[A-Za-z0-9]+$")
    status: SubscriptionStatus
    cancel_at_period_end: bool = False
    current_period_start: int | None = Field(default=None, ge=0)
    current_period_end: int | None = Field(default=None, ge=0)
    ended_at: int | None = Field(default=None, ge=0)
    metadata: dict[str, str] = Field(default_factory=dict)
    items: dict[Literal["data"], list[Item]]


class StripeEventData(BaseModel):
    object: SubscriptionObject


class StripeSubscriptionEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(pattern=r"^evt_[A-Za-z0-9]+$")
    type: str
    created: int = Field(ge=0)
    livemode: Literal[False]
    data: StripeEventData


def verify_signature(
    payload: bytes,
    signature_header: str,
    secret: str,
    *,
    now: int | None = None,
    tolerance: int = 300,
) -> bool:
    fields = [part.split("=", 1) for part in signature_header.split(",") if "=" in part]
    timestamp_text = next((value for key, value in fields if key == "t"), None)
    try:
        timestamp = int(timestamp_text or "")
    except ValueError:
        return False
    if abs((now if now is not None else int(time.time())) - timestamp) > tolerance:
        return False
    expected = hmac.new(
        secret.encode(), str(timestamp).encode() + b"." + payload, hashlib.sha256
    ).hexdigest()
    return any(
        key == "v1" and hmac.compare_digest(value.lower(), expected) for key, value in fields
    )


def unix_time(value: int | None) -> datetime | None:
    return datetime.fromtimestamp(value, UTC) if value is not None else None


async def process_webhook(settings: Settings, payload: bytes) -> bool:
    event = StripeSubscriptionEvent.model_validate(json.loads(payload))
    if event.type not in SUPPORTED_EVENTS:
        return False
    subscription = event.data.object
    if not subscription.items["data"]:
        raise ValueError("Stripe subscription has no price item.")
    price_id = subscription.items["data"][0].price.id
    plan_key = plan_for_price(settings, price_id)
    organization_text = subscription.metadata.get("tenantflowOrganizationId")
    if not plan_key or not organization_text:
        raise ValueError("Stripe subscription cannot be mapped to a TenantFlow plan.")
    organization_id = UUID(organization_text)
    if settings.stripe_webhook_database_url is None:
        raise RuntimeError("The dedicated Stripe webhook database role is not configured.")
    async with await psycopg.AsyncConnection.connect(
        str(settings.stripe_webhook_database_url)
    ) as connection:
        role = await connection.execute("""
            select r.rolsuper, r.rolbypassrls,
                   pg_has_role(current_user, 'tenantflow_stripe_webhook', 'member')
            from pg_roles r where r.rolname=current_user
        """)
        role_row = await role.fetchone()
        if role_row is None or role_row[0] or role_row[1] or not role_row[2]:
            raise RuntimeError("Stripe webhook database role is unsafe.")
        result = await connection.execute(
            """
            select public.process_stripe_subscription_event(
              %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
            )
        """,
            (
                event.id,
                event.type,
                organization_id,
                plan_key,
                subscription.customer,
                subscription.id,
                price_id,
                subscription.status.value,
                subscription.cancel_at_period_end,
                unix_time(subscription.current_period_start),
                unix_time(subscription.current_period_end),
                unix_time(subscription.ended_at),
                event.created,
                hashlib.sha256(payload).hexdigest(),
            ),
        )
        row = await result.fetchone()
        await connection.commit()
    return bool(row and row[0])
