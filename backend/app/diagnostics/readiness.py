import asyncio
import json
from pathlib import Path
from typing import Any
from uuid import UUID

import psycopg
from pydantic import AnyHttpUrl, BaseModel, PostgresDsn, ValidationError
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
    RLS_TEST_OWNER_ID: UUID
    RLS_TEST_ADMIN_ID: UUID
    RLS_TEST_MEMBER_ID: UUID
    RLS_TEST_OUTSIDER_ID: UUID


class ReadinessReport(BaseModel):
    runtime_connected: bool
    runtime_role_safe: bool
    migration_connected: bool
    migrations_applied: int
    migrations_expected: int
    test_identities_found: int
    test_identities_expected: int = 4

    @property
    def ready(self) -> bool:
        return (
            self.runtime_connected
            and self.runtime_role_safe
            and self.migration_connected
            and self.migrations_applied >= self.migrations_expected
            and self.test_identities_found == self.test_identities_expected
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
        migration_result = await connection.execute(
            "select count(*) from drizzle.__drizzle_migrations"
        )
        migration_row = await migration_result.fetchone()

    return ReadinessReport(
        runtime_connected=True,
        runtime_role_safe=True,
        migration_connected=True,
        migrations_applied=int(migration_row[0]) if migration_row else 0,
        migrations_expected=expected_migration_count(),
        test_identities_found=int(identity_row[0]) if identity_row else 0,
    )


async def async_main() -> int:
    try:
        config = ReadinessSettings()
    except ValidationError as error:
        missing = sorted(
            str(item["loc"][0])
            for item in error.errors()
            if item["type"] == "missing"
        )
        print(json.dumps({"ready": False, "missing": missing}, indent=2))
        return 2
    report = await check_readiness(config)
    print(report.model_dump_json(indent=2))
    return 0 if report.ready else 1


def main() -> None:
    raise SystemExit(asyncio.run(async_main()))


if __name__ == "__main__":
    main()
