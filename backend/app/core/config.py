from functools import lru_cache
from typing import Literal

from fastapi import Request
from pydantic import AnyHttpUrl, Field, PostgresDsn, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: Literal["development", "test", "production"] = "development"
    database_url: PostgresDsn
    supabase_url: AnyHttpUrl
    supabase_publishable_key: str | None = None
    supabase_jwt_audience: str = "authenticated"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    validate_database_role: bool = True
    frontend_app_url: AnyHttpUrl = AnyHttpUrl("http://localhost:3000")
    invitation_delivery_webhook_url: AnyHttpUrl | None = None
    invitation_delivery_webhook_secret: str | None = None
    invitation_dev_outbox: bool = False
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    stripe_starter_price_id: str | None = None
    stripe_growth_price_id: str | None = None
    stripe_webhook_database_url: PostgresDsn | None = None
    stripe_webhook_processor: Literal["typescript", "python", "disabled"] = "typescript"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def validate_invitation_delivery(self) -> "Settings":
        origins = [origin.rstrip("/") for origin in self.cors_origins]
        if "*" in origins:
            raise ValueError("Wildcard CORS origins are forbidden with authenticated requests.")
        if self.environment == "production":
            if any(not origin.startswith("https://") for origin in origins):
                raise ValueError("Production CORS origins must use HTTPS.")
            if self.frontend_app_url.scheme != "https":
                raise ValueError("The production frontend URL must use HTTPS.")
        self.cors_origins = origins
        if bool(self.invitation_delivery_webhook_url) != bool(
            self.invitation_delivery_webhook_secret
        ):
            raise ValueError("Invitation webhook URL and secret must be configured together.")
        if (
            self.invitation_delivery_webhook_secret is not None
            and len(self.invitation_delivery_webhook_secret) < 16
        ):
            raise ValueError("Invitation webhook secret must contain at least 16 characters.")
        if self.environment == "production" and self.invitation_dev_outbox:
            raise ValueError("The invitation development outbox is forbidden in production.")
        stripe_values = (
            self.stripe_secret_key,
            self.stripe_webhook_secret,
            self.stripe_starter_price_id,
            self.stripe_growth_price_id,
        )
        if any(stripe_values) and not all(stripe_values):
            raise ValueError("Stripe Test Mode configuration must be provided as a complete set.")
        if self.stripe_secret_key and not self.stripe_secret_key.startswith("sk_test_"):
            raise ValueError("Only Stripe Test Mode secret keys are accepted.")
        if self.stripe_webhook_processor == "python" and (
            not all(stripe_values) or self.stripe_webhook_database_url is None
        ):
            raise ValueError(
                "Python webhook processing requires Stripe keys and its dedicated database URL."
            )
        return self

    @property
    def supabase_issuer(self) -> str:
        return f"{str(self.supabase_url).rstrip('/')}/auth/v1"

    @property
    def supabase_jwks_url(self) -> str:
        return f"{self.supabase_issuer}/.well-known/jwks.json"

    @property
    def sqlalchemy_database_url(self) -> str:
        url = str(self.database_url)
        return url.replace("postgresql://", "postgresql+psycopg://", 1)


@lru_cache
def get_settings() -> Settings:
    return Settings()


def get_app_settings(request: Request) -> Settings:
    return request.app.state.settings  # type: ignore[no-any-return]
