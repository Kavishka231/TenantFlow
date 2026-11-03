from typing import cast

from fastapi import FastAPI
from fastapi.testclient import TestClient


def test_invoice_routes_are_in_openapi_contract(client: TestClient) -> None:
    paths = cast(FastAPI, client.app).openapi()["paths"]
    prefix = "/api/v1/organizations/{organization_id}/invoices"
    assert set(paths[prefix]) >= {"get", "post"}
    assert set(paths[f"{prefix}/{{invoice_id}}"]) >= {"get", "patch", "delete"}
    assert "post" in paths[f"{prefix}/{{invoice_id}}/payments"]
    assert "get" in paths[f"{prefix}/{{invoice_id}}/pdf"]


def test_invoice_endpoints_require_authentication(client: TestClient) -> None:
    response = client.get("/api/v1/organizations/10000000-0000-4000-8000-000000000001/invoices")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_required"
