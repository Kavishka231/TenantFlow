from app.diagnostics.readiness import ReadinessReport, expected_migration_count


def test_expected_migration_count_matches_versioned_journal() -> None:
    assert expected_migration_count() == 25


def test_readiness_requires_role_migrations_and_all_identities() -> None:
    ready = ReadinessReport(
        runtime_connected=True,
        runtime_role_safe=True,
        migration_connected=True,
        migrations_applied=25,
        migrations_expected=25,
        test_identities_found=4,
        webhook_connected=True,
        webhook_role_safe=True,
    )
    missing_identity = ready.model_copy(update={"test_identities_found": 3})
    database_ahead = ready.model_copy(update={"migrations_applied": 26})
    database_behind = ready.model_copy(update={"migrations_applied": 24})

    assert ready.ready is True
    assert missing_identity.ready is False
    assert database_ahead.ready is False
    assert database_behind.ready is False
