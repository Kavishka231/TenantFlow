from collections.abc import AsyncIterator, Iterator
from contextlib import contextmanager
from typing import Any, cast
from unittest.mock import AsyncMock
from uuid import UUID

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.models import AuthenticatedUser
from app.db.dependencies import get_rls_session


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


@contextmanager
def authenticated_api(
    client: TestClient, raw_session: AsyncMock
) -> Iterator[None]:
    user = AuthenticatedUser(
        id=UUID("00000000-0000-4000-8000-000000000001"),
        email="owner@example.com",
        role="authenticated",
        session_id=None,
    )

    async def override_user() -> AuthenticatedUser:
        return user

    async def override_session() -> AsyncIterator[AsyncSession]:
        yield cast(AsyncSession, raw_session)

    app = cast(FastAPI, client.app)
    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_rls_session] = override_session
    try:
        yield
    finally:
        app.dependency_overrides.clear()


def test_organization_list_contract_uses_authenticated_subject(
    client: TestClient,
) -> None:
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

    with authenticated_api(client, raw_session):
        response = client.get("/api/v1/organizations")

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": "10000000-0000-4000-8000-000000000001",
            "name": "Acme",
            "slug": "acme",
            "role": "owner",
        }
    ]
    assert raw_session.execute.await_args.args[1] == {
        "user_id": "00000000-0000-4000-8000-000000000001"
    }


def test_organization_creation_contract_rejects_unknown_fields(
    client: TestClient,
) -> None:
    raw_session = AsyncMock()

    with authenticated_api(client, raw_session):
        response = client.post(
            "/api/v1/organizations",
            json={"name": "Acme", "slug": "acme", "role": "owner"},
        )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
    raw_session.execute.assert_not_awaited()


def test_invitation_acceptance_contract_hashes_token_before_query(
    client: TestClient,
) -> None:
    raw_session = AsyncMock()
    raw_session.execute.return_value = QueryResult(
        [
            {
                "organization_id": UUID("10000000-0000-4000-8000-000000000001"),
                "organization_name": "Acme",
                "role": "member",
            }
        ]
    )
    plaintext_token = "a" * 43

    with authenticated_api(client, raw_session):
        response = client.post(
            "/api/v1/invitations/accept", json={"token": plaintext_token}
        )

    assert response.status_code == 200
    query_parameters = raw_session.execute.await_args.args[1]
    assert query_parameters["token_hash"] != plaintext_token
    assert len(query_parameters["token_hash"]) == 64
