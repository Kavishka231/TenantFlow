from typing import Any
from unittest.mock import AsyncMock, Mock
from uuid import UUID

import pytest

from app.customers.schemas import UpdateCustomerRequest
from app.customers.service import (
    CustomerConflictError,
    CustomerPlanLimitError,
    assert_customer_capacity,
    update_customer,
)
from app.organizations.models import OrganizationPermission, OrganizationRole
from app.organizations.permissions import role_has_permission

ORGANIZATION_ID = UUID("10000000-0000-4000-8000-000000000001")
CUSTOMER_ID = UUID("20000000-0000-4000-8000-000000000001")
USER_ID = UUID("00000000-0000-4000-8000-000000000001")


class MappingResult:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self.row = row

    def mappings(self) -> "MappingResult":
        return self

    def one_or_none(self) -> dict[str, Any] | None:
        return self.row


@pytest.mark.asyncio
async def test_customer_capacity_rejects_usage_at_plan_limit() -> None:
    session = AsyncMock()
    session.execute.side_effect = [
        Mock(),
        MappingResult({"plan_key": "starter", "max_customers": 10}),
    ]
    session.scalar.return_value = 10

    with pytest.raises(CustomerPlanLimitError):
        await assert_customer_capacity(session, ORGANIZATION_ID)


@pytest.mark.asyncio
async def test_customer_update_rejects_a_stale_version() -> None:
    session = AsyncMock()
    result = Mock()
    result.scalar_one_or_none.return_value = None
    session.execute.return_value = result
    request = UpdateCustomerRequest(
        name="Acme customer",
        email=None,
        phone=None,
        company=None,
        address=None,
        status="active",
        notes=None,
        version=2,
    )

    with pytest.raises(CustomerConflictError):
        await update_customer(
            session, ORGANIZATION_ID, CUSTOMER_ID, USER_ID, request
        )

    statement = str(session.execute.await_args.args[0])
    assert "customers.organization_id" in statement
    assert "customers.id" in statement
    assert "customers.version" in statement


def test_member_customer_permissions_are_read_only() -> None:
    assert role_has_permission(
        OrganizationRole.MEMBER, OrganizationPermission.READ_CUSTOMERS
    )
    assert not role_has_permission(
        OrganizationRole.MEMBER, OrganizationPermission.MANAGE_CUSTOMERS
    )
    for role in (OrganizationRole.OWNER, OrganizationRole.ADMIN):
        assert role_has_permission(role, OrganizationPermission.MANAGE_CUSTOMERS)
