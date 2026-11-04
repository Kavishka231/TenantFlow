from unittest.mock import AsyncMock, Mock
from uuid import UUID

import pytest

from app.deals.schemas import TransitionDealRequest
from app.deals.service import (
    DealConflictError,
    calculate_conversion_rate,
    require_deal_references,
    transition_deal,
)
from app.organizations.models import OrganizationPermission, OrganizationRole
from app.organizations.permissions import role_has_permission

ORGANIZATION_ID = UUID("10000000-0000-4000-8000-000000000001")
DEAL_ID = UUID("40000000-0000-4000-8000-000000000001")
STAGE_ID = UUID("50000000-0000-4000-8000-000000000001")


@pytest.mark.asyncio
async def test_transition_rejects_stale_version_before_stage_lookup() -> None:
    session = AsyncMock()
    result = Mock()
    result.scalar_one_or_none.return_value = Mock(version=4)
    session.execute.return_value = result

    with pytest.raises(DealConflictError, match="changed"):
        await transition_deal(
            session,
            ORGANIZATION_ID,
            DEAL_ID,
            TransitionDealRequest(stage_id=STAGE_ID, version=3, outcome_reason=None),
        )

    assert session.execute.await_count == 1
    assert "FOR UPDATE" in str(session.execute.await_args.args[0])


def test_member_deal_permissions_are_read_only() -> None:
    assert role_has_permission(OrganizationRole.MEMBER, OrganizationPermission.READ_DEALS)
    assert not role_has_permission(
        OrganizationRole.MEMBER, OrganizationPermission.MANAGE_DEALS
    )
    for role in (OrganizationRole.OWNER, OrganizationRole.ADMIN):
        assert role_has_permission(role, OrganizationPermission.MANAGE_DEALS)


def test_conversion_rate_matches_frontend_half_up_rounding() -> None:
    assert calculate_conversion_rate(1, 2) == 33.3
    assert calculate_conversion_rate(1, 15) == 6.3
    assert calculate_conversion_rate(0, 0) == 0


@pytest.mark.asyncio
async def test_unassigned_deal_does_not_require_a_member_lookup() -> None:
    session = AsyncMock()
    session.scalar.side_effect = [UUID(int=1), UUID(int=2)]
    await require_deal_references(
        session, ORGANIZATION_ID, UUID(int=1), STAGE_ID, None
    )
    assert session.scalar.await_count == 2
