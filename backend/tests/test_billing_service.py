from unittest.mock import AsyncMock
from uuid import UUID

import pytest
from pydantic import ValidationError

from app.billing.models import SubscriptionStatus
from app.billing.service import has_active_subscription
from app.billing.stripe import plan_for_price, price_for_plan
from app.core.config import Settings
from app.organizations.models import OrganizationPermission, OrganizationRole
from app.organizations.permissions import role_has_permission

ORGANIZATION_ID = UUID("10000000-0000-4000-8000-000000000001")


def stripe_settings(**changes: object) -> Settings:
    values: dict[str, object] = {
        "environment": "test",
        "database_url": "postgresql://runtime:x@localhost/db",
        "supabase_url": "https://example.supabase.co",
        "validate_database_role": False,
        "stripe_secret_key": "sk_test_example",
        "stripe_webhook_secret": "whsec_example",
        "stripe_starter_price_id": "price_Starter123",
        "stripe_growth_price_id": "price_Growth123",
    }
    values.update(changes)
    return Settings.model_validate(values)


def test_server_controls_plan_price_mapping() -> None:
    settings = stripe_settings()
    assert price_for_plan(settings, "starter") == "price_Starter123"
    assert plan_for_price(settings, "price_Growth123") == "growth"
    assert plan_for_price(settings, "price_Attacker") is None


def test_configuration_rejects_live_secret_and_incomplete_python_processor() -> None:
    with pytest.raises(ValidationError, match="Test Mode"):
        stripe_settings(stripe_secret_key="sk_live_forbidden")  # noqa: S106
    with pytest.raises(ValidationError, match="dedicated database"):
        stripe_settings(stripe_webhook_processor="python")


@pytest.mark.asyncio
async def test_active_subscription_states_block_duplicate_checkout() -> None:
    session = AsyncMock()
    session.scalar.return_value = SubscriptionStatus.PAST_DUE
    assert await has_active_subscription(session, ORGANIZATION_ID)
    session.scalar.return_value = SubscriptionStatus.CANCELED
    assert not await has_active_subscription(session, ORGANIZATION_ID)


def test_billing_management_is_owner_only() -> None:
    assert role_has_permission(OrganizationRole.OWNER, OrganizationPermission.MANAGE_BILLING)
    assert not role_has_permission(OrganizationRole.ADMIN, OrganizationPermission.MANAGE_BILLING)
    assert not role_has_permission(OrganizationRole.MEMBER, OrganizationPermission.MANAGE_BILLING)
