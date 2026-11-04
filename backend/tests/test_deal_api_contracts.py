from typing import cast

from fastapi import FastAPI
from fastapi.testclient import TestClient


def test_deal_routes_are_in_openapi_contract(client: TestClient) -> None:
    paths = cast(FastAPI, client.app).openapi()["paths"]
    prefix = "/api/v1/organizations/{organization_id}/deals"
    assert set(paths[prefix]) >= {"get", "post"}
    assert set(paths[f"{prefix}/{{deal_id}}"]) >= {"get", "patch", "delete"}
    assert "get" in paths[f"{prefix}/pipeline"]
    assert "get" in paths[f"{prefix}/metrics"]
    assert "post" in paths[f"{prefix}/{{deal_id}}/transition"]
    assert "post" in paths[f"{prefix}/{{deal_id}}/notes"]


def test_deal_endpoints_require_authentication(client: TestClient) -> None:
    response = client.get(
        "/api/v1/organizations/10000000-0000-4000-8000-000000000001/deals/pipeline"
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_required"
