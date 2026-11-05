import pytest
from pydantic import ValidationError

from app.core.config import Settings


def settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "database_url": "postgresql://runtime:secret@localhost:5432/tenantflow",
        "supabase_url": "https://example.supabase.co",
        "validate_database_role": False,
    }
    values.update(overrides)
    return Settings(**values)  # type: ignore[arg-type]


def test_authenticated_cors_rejects_wildcard_origins() -> None:
    with pytest.raises(ValidationError, match="Wildcard CORS origins"):
        settings(cors_origins=["*"])


def test_production_requires_https_application_origins() -> None:
    with pytest.raises(ValidationError, match="Production CORS origins must use HTTPS"):
        settings(environment="production", cors_origins=["http://tenantflow.example"])
    with pytest.raises(ValidationError, match="production frontend URL must use HTTPS"):
        settings(
            environment="production",
            cors_origins=["https://tenantflow.example"],
            frontend_app_url="http://tenantflow.example",
        )


def test_production_accepts_normalized_https_origins() -> None:
    configured = settings(
        environment="production",
        cors_origins=["https://tenantflow.example/"],
        frontend_app_url="https://tenantflow.example",
    )

    assert configured.cors_origins == ["https://tenantflow.example"]
