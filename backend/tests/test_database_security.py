from uuid import UUID

import pytest

from app.db.session import (
    RuntimeRoleState,
    UnsafeRuntimeRoleError,
    assert_safe_runtime_role,
    claims_for_user,
)


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
