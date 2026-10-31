from typing import cast
from unittest.mock import AsyncMock
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.team.service import change_member_role, remove_member, transfer_ownership


class ScalarResult:
    def __init__(self, value: bool) -> None:
        self.value = value

    def scalar_one(self) -> bool:
        return self.value


async def test_role_change_calls_protected_database_function() -> None:
    organization_id = UUID("10000000-0000-4000-8000-000000000001")
    user_id = UUID("20000000-0000-4000-8000-000000000001")
    raw_session = AsyncMock()
    raw_session.execute.return_value = ScalarResult(True)

    changed = await change_member_role(
        cast(AsyncSession, raw_session), organization_id, user_id, "admin"
    )

    assert changed is True
    assert raw_session.execute.await_args.args[1] == {
        "organization_id": str(organization_id),
        "role": "admin",
        "user_id": str(user_id),
    }


async def test_membership_functions_preserve_rejected_result() -> None:
    organization_id = UUID("10000000-0000-4000-8000-000000000001")
    user_id = UUID("20000000-0000-4000-8000-000000000001")
    raw_session = AsyncMock()
    raw_session.execute.return_value = ScalarResult(False)
    session = cast(AsyncSession, raw_session)

    assert await remove_member(session, organization_id, user_id) is False
    assert await transfer_ownership(session, organization_id, user_id) is False
