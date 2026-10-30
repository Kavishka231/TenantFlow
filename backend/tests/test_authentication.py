from datetime import UTC, datetime, timedelta
from typing import Any, cast
from uuid import uuid4

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth.jwt import SupabaseJwtVerifier, TokenVerificationError
from app.core.config import Settings


class Key:
    def __init__(self, key: Any) -> None:
        self.key = key


class Keys:
    def __init__(self, keys: dict[str, Any]) -> None:
        self.keys = keys
        self.requested: list[str] = []

    def get_signing_key_from_jwt(self, token: str) -> Key:
        kid = str(jwt.get_unverified_header(token)["kid"])
        self.requested.append(kid)
        return Key(self.keys[kid])


@pytest.fixture
def private_keys() -> dict[str, Any]:
    return {
        "key-one": rsa.generate_private_key(public_exponent=65537, key_size=2048),
        "key-two": rsa.generate_private_key(public_exponent=65537, key_size=2048),
    }


def make_token(
    settings: Settings,
    private_key: Any,
    *,
    kid: str = "key-one",
    audience: str | None = None,
    expires_delta: timedelta = timedelta(minutes=5),
    issuer: str | None = None,
    role: str = "authenticated",
) -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "aud": audience or settings.supabase_jwt_audience,
            "email": "user@example.com",
            "exp": now + expires_delta,
            "iat": now,
            "iss": issuer or settings.supabase_issuer,
            "role": role,
            "session_id": str(uuid4()),
            "sub": str(uuid4()),
        },
        private_key,
        algorithm="RS256",
        headers={"kid": kid},
    )


def test_verifies_signature_claims_and_key_rotation(
    settings: Settings, private_keys: dict[str, Any]
) -> None:
    keys = Keys({kid: key.public_key() for kid, key in private_keys.items()})
    verifier = SupabaseJwtVerifier(settings, keys)
    first = verifier.verify(make_token(settings, private_keys["key-one"], kid="key-one"))
    second = verifier.verify(make_token(settings, private_keys["key-two"], kid="key-two"))
    assert first.email == "user@example.com"
    assert second.role == "authenticated"
    assert keys.requested == ["key-one", "key-two"]


@pytest.mark.parametrize("invalid_claim", ["audience", "issuer", "expired", "role"])
def test_rejects_invalid_claims(
    invalid_claim: str, settings: Settings, private_keys: dict[str, Any]
) -> None:
    key = private_keys["key-one"]
    keys = Keys({"key-one": key.public_key()})
    kwargs: dict[str, Any] = {}
    if invalid_claim == "audience":
        kwargs["audience"] = "another-audience"
    elif invalid_claim == "issuer":
        kwargs["issuer"] = "https://attacker.example/auth/v1"
    elif invalid_claim == "expired":
        kwargs["expires_delta"] = timedelta(minutes=-5)
    else:
        kwargs["role"] = "service_role"
    with pytest.raises(TokenVerificationError):
        SupabaseJwtVerifier(settings, keys).verify(make_token(settings, key, **kwargs))


def test_auth_me_requires_a_bearer_token(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_required"
    assert response.headers["www-authenticate"] == "Bearer"


def test_auth_me_returns_verified_identity(
    client: TestClient, settings: Settings, private_keys: dict[str, Any]
) -> None:
    key = private_keys["key-one"]
    cast(FastAPI, client.app).state.jwt_verifier = SupabaseJwtVerifier(
        settings, Keys({"key-one": key.public_key()})
    )
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {make_token(settings, key)}"},
    )
    assert response.status_code == 200
    assert response.json()["email"] == "user@example.com"
    assert response.json()["role"] == "authenticated"
