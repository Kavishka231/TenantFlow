import asyncio
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import UUID

import psycopg
from pydantic import AnyHttpUrl, BaseModel, PostgresDsn, ValidationError, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.config import Settings
from app.db.session import create_database_engine, validate_runtime_role

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


class ReadinessSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(
            REPOSITORY_ROOT / "backend/.env.test.local",
            REPOSITORY_ROOT / "frontend/.env.test.local",
        ),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: PostgresDsn
    MIGRATION_DATABASE_URL: PostgresDsn
    SUPABASE_URL: AnyHttpUrl
    SUPABASE_PUBLISHABLE_KEY: str
    STRIPE_SECRET_KEY: str
    STRIPE_WEBHOOK_SECRET: str
    STRIPE_STARTER_PRICE_ID: str
    STRIPE_GROWTH_PRICE_ID: str
    STRIPE_WEBHOOK_DATABASE_URL: PostgresDsn
    RLS_TEST_OWNER_ID: UUID
    RLS_TEST_ADMIN_ID: UUID
    RLS_TEST_MEMBER_ID: UUID
    RLS_TEST_OUTSIDER_ID: UUID

    @model_validator(mode="after")
    def validate_distinct_test_identities(self) -> "ReadinessSettings":
        identities = {
            self.RLS_TEST_OWNER_ID,
            self.RLS_TEST_ADMIN_ID,
            self.RLS_TEST_MEMBER_ID,
            self.RLS_TEST_OUTSIDER_ID,
        }
        if len(identities) != 4:
            raise ValueError("All four RLS test identity IDs must be distinct.")
        return self


class ReadinessReport(BaseModel):
    runtime_connected: bool
    runtime_role_safe: bool
    migration_connected: bool
    migrations_applied: int
    migrations_expected: int
    test_identities_found: int
    auth_identities_found: int
    confirmed_identities_found: int
    test_identities_expected: int = 4
    webhook_connected: bool
    webhook_role_safe: bool

    @property
    def ready(self) -> bool:
        return (
            self.runtime_connected
            and self.runtime_role_safe
            and self.migration_connected
            and self.migrations_applied == self.migrations_expected
            and self.test_identities_found == self.test_identities_expected
            and self.auth_identities_found == self.test_identities_expected
            and self.confirmed_identities_found == self.test_identities_expected
            and self.webhook_connected
            and self.webhook_role_safe
        )


@dataclass(frozen=True)
class WebhookRoleState:
    authenticated_member: bool
    bypass_rls: bool
    capability_member: bool
    owns_public_tables: bool
    superuser: bool


def webhook_role_is_safe(state: WebhookRoleState) -> bool:
    return (
        not state.superuser
        and not state.bypass_rls
        and state.capability_member
        and not state.authenticated_member
        and not state.owns_public_tables
    )


def expected_migration_count() -> int:
    journal_path = REPOSITORY_ROOT / "frontend/drizzle/meta/_journal.json"
    journal: dict[str, Any] = json.loads(journal_path.read_text(encoding="utf-8"))
    entries = journal.get("entries")
    if not isinstance(entries, list):
        raise RuntimeError("The Drizzle migration journal is invalid.")
    return len(entries)


async def check_readiness(config: ReadinessSettings) -> ReadinessReport:
    runtime_settings = Settings(
        database_url=config.DATABASE_URL,
        supabase_url=config.SUPABASE_URL,
        supabase_publishable_key=config.SUPABASE_PUBLISHABLE_KEY,
    )
    engine = create_database_engine(runtime_settings)
    try:
        await validate_runtime_role(engine)
    finally:
        await engine.dispose()

    identity_ids = (
        config.RLS_TEST_OWNER_ID,
        config.RLS_TEST_ADMIN_ID,
        config.RLS_TEST_MEMBER_ID,
        config.RLS_TEST_OUTSIDER_ID,
    )
    async with await psycopg.AsyncConnection.connect(
        str(config.MIGRATION_DATABASE_URL)
    ) as connection:
        identity_result = await connection.execute(
            "select count(*) from public.profiles where id = any(%s)",
            (list(identity_ids),),
        )
        identity_row = await identity_result.fetchone()
        auth_identity_result = await connection.execute(
            """select count(*),
                      count(*) filter (where email_confirmed_at is not null)
               from auth.users where id = any(%s)""",
            (list(identity_ids),),
        )
        auth_identity_row = await auth_identity_result.fetchone()
        migration_result = await connection.execute(
            "select count(*) from drizzle.__drizzle_migrations"
        )
        migration_row = await migration_result.fetchone()

    async with await psycopg.AsyncConnection.connect(
        str(config.STRIPE_WEBHOOK_DATABASE_URL)
    ) as webhook_connection:
        webhook_role_result = await webhook_connection.execute(
            """select r.rolsuper, r.rolbypassrls,
                      pg_has_role(current_user, 'tenantflow_stripe_webhook', 'member'),
                      pg_has_role(current_user, 'authenticated', 'member'),
                      exists (
                        select 1 from pg_class c
                        join pg_namespace n on n.oid = c.relnamespace
                        where n.nspname = 'public' and c.relowner = r.oid
                      )
               from pg_roles r where r.rolname=current_user"""
        )
        webhook_role = await webhook_role_result.fetchone()
    webhook_safe = webhook_role is not None and webhook_role_is_safe(
        WebhookRoleState(
            superuser=bool(webhook_role[0]),
            bypass_rls=bool(webhook_role[1]),
            capability_member=bool(webhook_role[2]),
            authenticated_member=bool(webhook_role[3]),
            owns_public_tables=bool(webhook_role[4]),
        )
    )

    return ReadinessReport(
        runtime_connected=True,
        runtime_role_safe=True,
        migration_connected=True,
        migrations_applied=int(migration_row[0]) if migration_row else 0,
        migrations_expected=expected_migration_count(),
        test_identities_found=int(identity_row[0]) if identity_row else 0,
        auth_identities_found=int(auth_identity_row[0]) if auth_identity_row else 0,
        confirmed_identities_found=int(auth_identity_row[1]) if auth_identity_row else 0,
        webhook_connected=True,
        webhook_role_safe=webhook_safe,
    )


async def async_main() -> int:
    try:
        config = ReadinessSettings()
    except ValidationError as error:
        missing = sorted(
            str(item["loc"][0]) for item in error.errors() if item["type"] == "missing"
        )
        invalid = sorted(
            str(item["loc"][0]) if item["loc"] else "configuration"
            for item in error.errors()
            if item["type"] != "missing"
        )
        print(json.dumps({"ready": False, "missing": missing, "invalid": invalid}, indent=2))
        return 2
    report = await check_readiness(config)
    print(report.model_dump_json(indent=2))
    return 0 if report.ready else 1


def main() -> None:
    raise SystemExit(asyncio.run(async_main()))


if __name__ == "__main__":
    main()
