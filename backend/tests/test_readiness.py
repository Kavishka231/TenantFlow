import pytest
from pydantic import ValidationError

from app.diagnostics.readiness import (
    ReadinessReport,
    ReadinessSettings,
    WebhookRoleState,
    expected_migration_count,
    webhook_role_is_safe,
)


def test_expected_migration_count_matches_versioned_journal() -> None:
    assert expected_migration_count() == 25


def test_readiness_requires_role_migrations_and_all_identities() -> None:
    ready = ReadinessReport(
        runtime_connected=True,
        runtime_role_safe=True,
        migration_connected=True,
        migrations_applied=25,
        migrations_expected=25,
        test_identities_found=4,
        auth_identities_found=4,
        confirmed_identities_found=4,
        webhook_connected=True,
        webhook_role_safe=True,
    )
    missing_identity = ready.model_copy(update={"test_identities_found": 3})
    missing_auth_identity = ready.model_copy(update={"auth_identities_found": 3})
    unconfirmed_identity = ready.model_copy(update={"confirmed_identities_found": 3})
    database_ahead = ready.model_copy(update={"migrations_applied": 26})
    database_behind = ready.model_copy(update={"migrations_applied": 24})

    assert ready.ready is True
    assert missing_identity.ready is False
    assert missing_auth_identity.ready is False
    assert unconfirmed_identity.ready is False
    assert database_ahead.ready is False
    assert database_behind.ready is False


def test_readiness_requires_four_distinct_test_identities() -> None:
    repeated_id = "00000000-0000-4000-8000-000000000001"
    with pytest.raises(ValidationError, match="must be distinct"):
        ReadinessSettings(
            DATABASE_URL="postgresql://runtime:secret@localhost/postgres",
            MIGRATION_DATABASE_URL="postgresql://migration:secret@localhost/postgres",
            SUPABASE_URL="https://example.supabase.co",
            SUPABASE_PUBLISHABLE_KEY="publishable-key",
            STRIPE_SECRET_KEY="sk_test_example",  # noqa: S106 - inert test value
            STRIPE_WEBHOOK_SECRET="whsec_example",  # noqa: S106 - inert test value
            STRIPE_STARTER_PRICE_ID="price_starter",
            STRIPE_GROWTH_PRICE_ID="price_growth",
            STRIPE_WEBHOOK_DATABASE_URL=(
                "postgresql://stripe:secret@localhost/postgres"
            ),
            RLS_TEST_OWNER_ID=repeated_id,
            RLS_TEST_ADMIN_ID=repeated_id,
            RLS_TEST_MEMBER_ID="00000000-0000-4000-8000-000000000003",
            RLS_TEST_OUTSIDER_ID="00000000-0000-4000-8000-000000000004",
        )


@pytest.mark.parametrize(
    "state",
    [
        WebhookRoleState(True, False, True, False, False),
        WebhookRoleState(False, True, True, False, False),
        WebhookRoleState(False, False, False, False, False),
        WebhookRoleState(False, False, True, True, False),
        WebhookRoleState(False, False, True, False, True),
    ],
)
def test_webhook_readiness_rejects_privileged_roles(state: WebhookRoleState) -> None:
    assert webhook_role_is_safe(state) is False


def test_webhook_readiness_accepts_dedicated_capability_only() -> None:
    assert webhook_role_is_safe(
        WebhookRoleState(False, False, True, False, False)
    ) is True
