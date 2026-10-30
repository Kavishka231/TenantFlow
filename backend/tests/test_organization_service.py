from typing import Any, cast
from unittest.mock import AsyncMock
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.organizations.service import get_organization, list_organizations


class MappingRows:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    def __iter__(self) -> Any:
        return iter(self.rows)

    def one_or_none(self) -> dict[str, Any] | None:
        return self.rows[0] if self.rows else None


class QueryResult:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    def mappings(self) -> MappingRows:
        return MappingRows(self.rows)


async def test_list_organizations_binds_verified_user_id() -> None:
    user_id = UUID("00000000-0000-4000-8000-000000000001")
    raw_session = AsyncMock()
    raw_session.execute.return_value = QueryResult(
        [
            {
                "id": UUID("10000000-0000-4000-8000-000000000001"),
                "name": "Acme",
                "slug": "acme",
                "role": "owner",
            }
        ]
    )

    organizations = await list_organizations(cast(AsyncSession, raw_session), user_id)

    assert organizations[0].name == "Acme"
    assert raw_session.execute.await_args.args[1] == {"user_id": str(user_id)}


async def test_get_organization_binds_user_and_tenant_scope() -> None:
    user_id = UUID("00000000-0000-4000-8000-000000000001")
    organization_id = UUID("10000000-0000-4000-8000-000000000001")
    raw_session = AsyncMock()
    raw_session.execute.return_value = QueryResult([])

    organization = await get_organization(
        cast(AsyncSession, raw_session), user_id, organization_id
    )

    assert organization is None
    assert raw_session.execute.await_args.args[1] == {
        "organization_id": str(organization_id),
        "user_id": str(user_id),
    }
