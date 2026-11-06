from uuid import UUID

import pytest

from app.db.session import (
    RLS_TABLES,
    RuntimeRoleState,
    UnsafeRuntimeRoleError,
    assert_safe_runtime_role,
    claims_for_user,
)


def test_runtime_ownership_guard_covers_every_rls_table() -> None:
    assert set(RLS_TABLES) == {
        "audit_events",
        "customers",
        "deal_activities",
        "deals",
        "expense_categories",
        "expenses",
        "invoice_items",
        "invoices",
        "organization_invitations",
        "organization_members",
        "organization_subscriptions",
        "organizations",
        "payment_records",
        "pipeline_stages",
        "profiles",
        "stripe_customers",
        "stripe_webhook_events",
        "subscription_plans",
    }


def test_claim_context_contains_only_verified_identity_and_role() -> None:
    assert claims_for_user(UUID("00000000-0000-4000-8000-000000000001")) == (
        '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001"}'
    )


@pytest.mark.parametrize(
    "unsafe_state",
    [
        RuntimeRoleState(False, False, False, False),
        RuntimeRoleState(True, True, False, False),
        RuntimeRoleState(True, False, True, False),
        RuntimeRoleState(True, False, False, True),
    ],
)
def test_rejects_privileged_or_incompatible_runtime_roles(
    unsafe_state: RuntimeRoleState,
) -> None:
    with pytest.raises(UnsafeRuntimeRoleError):
        assert_safe_runtime_role(unsafe_state)


def test_accepts_restricted_authenticated_runtime_role() -> None:
    assert_safe_runtime_role(RuntimeRoleState(True, False, False, False))
