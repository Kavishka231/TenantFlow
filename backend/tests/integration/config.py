import os
from collections.abc import Mapping
from pathlib import Path
from uuid import UUID

from dotenv import load_dotenv
from pydantic import AnyHttpUrl, BaseModel, ConfigDict, PostgresDsn, ValidationError

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
TEST_ENV_FILES = (
    REPOSITORY_ROOT / "backend/.env.test.local",
    REPOSITORY_ROOT / "frontend/.env.test.local",
)

for env_file in TEST_ENV_FILES:
    load_dotenv(env_file, override=False)


class LiveTestConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")

    DATABASE_URL: PostgresDsn
    MIGRATION_DATABASE_URL: PostgresDsn
    SUPABASE_URL: AnyHttpUrl
    RLS_TEST_OWNER_ID: UUID
    RLS_TEST_ADMIN_ID: UUID
    RLS_TEST_MEMBER_ID: UUID
    RLS_TEST_OUTSIDER_ID: UUID


def parse_live_test_config(
    environment: Mapping[str, str] | None = None,
) -> LiveTestConfig | None:
    try:
        return LiveTestConfig.model_validate(dict(environment or os.environ))
    except ValidationError:
        return None


def missing_live_test_variables(
    environment: Mapping[str, str] | None = None,
) -> list[str]:
    values = environment or os.environ
    return [name for name in LiveTestConfig.model_fields if not values.get(name)]
