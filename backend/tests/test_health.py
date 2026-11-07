from fastapi.testclient import TestClient


def test_health(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {
        "service": "tenantflow-backend",
        "status": "ok",
        "version": "0.1.0",
    }
    assert response.headers["x-request-id"]
    assert response.headers["x-content-type-options"] == "nosniff"


def test_replaces_untrusted_request_ids(client: TestClient) -> None:
    response = client.get("/api/v1/health", headers={"X-Request-ID": "unsafe value"})

    assert response.status_code == 200
    assert response.headers["x-request-id"] != "unsafe value"


def test_cors_preflight_allows_receipt_upload_headers(client: TestClient) -> None:
    response = client.options(
        "/api/v1/organizations/00000000-0000-4000-8000-000000000001/expenses/"
        "00000000-0000-4000-8000-000000000002/receipt",
        headers={
            "Access-Control-Request-Headers": (
                "authorization,content-type,x-expense-version,x-receipt-name"
            ),
            "Access-Control-Request-Method": "PUT",
            "Origin": "http://localhost:3000",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "PUT" in response.headers["access-control-allow-methods"]
    assert "x-receipt-name" in response.headers["access-control-allow-headers"].lower()
