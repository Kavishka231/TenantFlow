from unittest.mock import AsyncMock, Mock
from uuid import UUID

import pytest

from app.expenses.models import ExpenseStatus
from app.expenses.schemas import TransitionExpenseRequest
from app.expenses.service import ExpenseConflictError, transition_expense
from app.organizations.models import OrganizationPermission, OrganizationRole
from app.organizations.permissions import role_has_permission

ORGANIZATION_ID = UUID("10000000-0000-4000-8000-000000000001")
EXPENSE_ID = UUID("70000000-0000-4000-8000-000000000001")


@pytest.mark.asyncio
async def test_transition_rejects_stale_version_under_row_lock() -> None:
    session = AsyncMock()
    result = Mock()
    result.scalar_one_or_none.return_value = Mock(version=3, status=ExpenseStatus.PENDING)
    session.execute.return_value = result
    with pytest.raises(ExpenseConflictError, match="changed"):
        await transition_expense(
            session,
            ORGANIZATION_ID,
            EXPENSE_ID,
            TransitionExpenseRequest(version=2, status=ExpenseStatus.PAID, paid_date="2026-11-01"),
        )
    assert "FOR UPDATE" in str(session.execute.await_args.args[0])


@pytest.mark.asyncio
async def test_transition_rejects_invalid_reimbursed_to_pending_change() -> None:
    session = AsyncMock()
    result = Mock()
    result.scalar_one_or_none.return_value = Mock(version=3, status=ExpenseStatus.REIMBURSED)
    session.execute.return_value = result
    with pytest.raises(ExpenseConflictError, match="cannot transition"):
        await transition_expense(
            session,
            ORGANIZATION_ID,
            EXPENSE_ID,
            TransitionExpenseRequest(version=3, status=ExpenseStatus.PENDING, paid_date=None),
        )


def test_member_expense_permissions_are_read_only() -> None:
    assert role_has_permission(OrganizationRole.MEMBER, OrganizationPermission.READ_EXPENSES)
    assert not role_has_permission(OrganizationRole.MEMBER, OrganizationPermission.MANAGE_EXPENSES)
    for role in (OrganizationRole.OWNER, OrganizationRole.ADMIN):
        assert role_has_permission(role, OrganizationPermission.MANAGE_EXPENSES)
