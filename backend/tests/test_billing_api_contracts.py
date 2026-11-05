from typing import cast

from fastapi import FastAPI
from fastapi.testclient import TestClient


def test_billing_and_analytics_routes_are_in_openapi(client: TestClient) -> None:
    paths = cast(FastAPI, client.app).openapi()["paths"]
    prefix = "/api/v1/organizations/{organization_id}"
    assert "get" in paths[f"{prefix}/billing"]
    assert "get" in paths[f"{prefix}/billing/plans"]
    assert "post" in paths[f"{prefix}/billing/checkout"]
    assert "post" in paths[f"{prefix}/billing/portal"]
    assert "get" in paths[f"{prefix}/analytics/dashboard"]
    assert "post" in paths["/api/v1/stripe/webhook"]


def test_billing_and_analytics_require_authentication(client: TestClient) -> None:
    organization = "10000000-0000-4000-8000-000000000001"
    assert client.get(f"/api/v1/organizations/{organization}/billing").status_code == 401
    assert (
        client.get(
            f"/api/v1/organizations/{organization}/analytics/dashboard",
            params={"start": "2026-01-01", "end_exclusive": "2026-02-01"},
        ).status_code
        == 401
    )


def test_python_webhook_fails_closed_when_processor_is_inactive(client: TestClient) -> None:
    response = client.post("/api/v1/stripe/webhook", content=b"{}")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "webhook_processor_inactive"
