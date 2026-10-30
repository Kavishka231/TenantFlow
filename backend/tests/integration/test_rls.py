import os
from uuid import UUID, uuid4

import psycopg
import pytest

from app.core.config import Settings
from app.db.session import (
    create_database_engine,
    create_session_factory,
    rls_transaction,
    validate_runtime_role,
)
from app.organizations.service import get_organization, list_organizations

REQUIRED_VARIABLES = (
    "DATABASE_URL",
    "MIGRATION_DATABASE_URL",
    "RLS_TEST_MEMBER_ID",
    "RLS_TEST_OUTSIDER_ID",
    "SUPABASE_URL",
)
LIVE_ENV = {name: os.getenv(name) for name in REQUIRED_VARIABLES}
pytestmark = pytest.mark.skipif(
    not all(LIVE_ENV.values()),
    reason="live RLS credentials and disposable test identities are not configured",
)


async def test_runtime_context_cannot_cross_organization_boundary() -> None:
    runtime_url = str(LIVE_ENV["DATABASE_URL"])
    migration_url = str(LIVE_ENV["MIGRATION_DATABASE_URL"])
    member_id = UUID(str(LIVE_ENV["RLS_TEST_MEMBER_ID"]))
    outsider_id = UUID(str(LIVE_ENV["RLS_TEST_OUTSIDER_ID"]))
    organization_a = uuid4()
    organization_b = uuid4()

    async with await psycopg.AsyncConnection.connect(migration_url) as fixtures:
        await fixtures.execute(
            """
            insert into public.organizations (id, name, slug, created_by)
            values (%s, 'Python RLS A', %s, %s), (%s, 'Python RLS B', %s, %s)
            """,
            (
                organization_a,
                f"python-rls-a-{organization_a}",
                member_id,
                organization_b,
                f"python-rls-b-{organization_b}",
                outsider_id,
            ),
        )
        await fixtures.execute(
            """
            insert into public.organization_members (organization_id, user_id, role)
            values (%s, %s, 'member'), (%s, %s, 'owner')
            """,
            (organization_a, member_id, organization_b, outsider_id),
        )
        await fixtures.commit()

        settings = Settings(
            database_url=runtime_url,
            supabase_url=str(LIVE_ENV["SUPABASE_URL"]),
        )
        engine = create_database_engine(settings)
        try:
            await validate_runtime_role(engine)
            session_factory = create_session_factory(engine)
            async with rls_transaction(session_factory, member_id) as member_session:
                member_organizations = await list_organizations(member_session, member_id)
                cross_tenant = await get_organization(
                    member_session, member_id, organization_b
                )

            assert [item.id for item in member_organizations] == [organization_a]
            assert cross_tenant is None
        finally:
            await engine.dispose()
            await fixtures.execute(
                "delete from public.organizations where id in (%s, %s)",
                (organization_a, organization_b),
            )
            await fixtures.commit()
