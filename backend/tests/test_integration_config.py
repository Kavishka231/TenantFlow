from tests.integration.config import (
    missing_live_test_variables,
    parse_live_test_config,
)


def complete_environment() -> dict[str, str]:
    return {
        "DATABASE_URL": "postgresql://runtime:secret@localhost:5432/postgres",
        "MIGRATION_DATABASE_URL": "postgresql://migration:secret@localhost:5432/postgres",
        "SUPABASE_URL": "https://example.supabase.co",
        "RLS_TEST_OWNER_ID": "00000000-0000-4000-8000-000000000001",
        "RLS_TEST_ADMIN_ID": "00000000-0000-4000-8000-000000000002",
        "RLS_TEST_MEMBER_ID": "00000000-0000-4000-8000-000000000003",
        "RLS_TEST_OUTSIDER_ID": "00000000-0000-4000-8000-000000000004",
    }


def test_live_configuration_parses_without_exposing_values() -> None:
    parsed = parse_live_test_config(complete_environment())

    assert parsed is not None
    assert str(parsed.RLS_TEST_OWNER_ID).endswith("0001")


def test_live_configuration_reports_missing_names() -> None:
    environment = complete_environment()
    del environment["DATABASE_URL"]

    assert parse_live_test_config(environment) is None
    assert missing_live_test_variables(environment) == ["DATABASE_URL"]
