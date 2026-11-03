from unittest.mock import AsyncMock, Mock
from uuid import UUID

import pytest

from app.invoices.models import InvoiceStatus
from app.invoices.service import InvoiceConflictError, transition_invoice
from app.organizations.models import OrganizationPermission, OrganizationRole
from app.organizations.permissions import role_has_permission

ORGANIZATION_ID = UUID("10000000-0000-4000-8000-000000000001")
INVOICE_ID = UUID("30000000-0000-4000-8000-000000000001")


@pytest.mark.asyncio
async def test_lifecycle_rejects_stale_version_before_database_function() -> None:
    session = AsyncMock()
    invoice = Mock(status=InvoiceStatus.DRAFT, version=3)
    result = Mock()
    result.scalar_one_or_none.return_value = invoice
    session.execute.return_value = result

    with pytest.raises(InvoiceConflictError, match="changed"):
        await transition_invoice(session, ORGANIZATION_ID, INVOICE_ID, 2, "send")

    assert session.execute.await_count == 1
    assert "FOR UPDATE" in str(session.execute.await_args_list[0].args[0])


def test_member_invoice_permissions_are_read_only() -> None:
    assert role_has_permission(OrganizationRole.MEMBER, OrganizationPermission.READ_INVOICES)
    assert not role_has_permission(OrganizationRole.MEMBER, OrganizationPermission.MANAGE_INVOICES)
    for role in (OrganizationRole.OWNER, OrganizationRole.ADMIN):
        assert role_has_permission(role, OrganizationPermission.MANAGE_INVOICES)
