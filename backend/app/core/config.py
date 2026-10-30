from functools import lru_cache
from typing import Literal

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
    supabase_jwt_audience: str = "authenticated"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    validate_database_role: bool = True
    frontend_app_url: AnyHttpUrl = AnyHttpUrl("http://localhost:3000")
    invitation_delivery_webhook_url: AnyHttpUrl | None = None
    invitation_delivery_webhook_secret: str | None = None
    invitation_dev_outbox: bool = False

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def validate_invitation_delivery(self) -> "Settings":
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
