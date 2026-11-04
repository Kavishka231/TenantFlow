from uuid import uuid4

import psycopg
import pytest
from sqlalchemy import text

from app.core.config import Settings
from app.db.session import (
    create_database_engine,
    create_session_factory,
    rls_transaction,
    validate_runtime_role,
)
from app.deals.service import get_deal, get_pipeline
from tests.integration.config import parse_live_test_config

LIVE_ENV = parse_live_test_config()
pytestmark = pytest.mark.skipif(
    LIVE_ENV is None,
    reason="live RLS credentials and disposable test identities are not configured",
)


async def test_deal_rls_allows_member_reads_but_denies_mutation_and_cross_tenant() -> None:
    assert LIVE_ENV is not None
    owner_id = LIVE_ENV.RLS_TEST_OWNER_ID
    member_id = LIVE_ENV.RLS_TEST_MEMBER_ID
    outsider_id = LIVE_ENV.RLS_TEST_OUTSIDER_ID
    organization_a, organization_b = uuid4(), uuid4()
    customer_a, customer_b = uuid4(), uuid4()
    stage_a, stage_b = uuid4(), uuid4()
    deal_a, deal_b = uuid4(), uuid4()

    async with await psycopg.AsyncConnection.connect(
        str(LIVE_ENV.MIGRATION_DATABASE_URL)
    ) as fixtures:
        await fixtures.execute(
            """
            insert into public.organizations (id, name, slug, created_by)
            values (%s, 'Deal RLS A', %s, %s), (%s, 'Deal RLS B', %s, %s)
            """,
            (
                organization_a,
                f"deal-rls-a-{organization_a}",
                owner_id,
                organization_b,
                f"deal-rls-b-{organization_b}",
                outsider_id,
            ),
        )
        await fixtures.execute(
            """insert into public.organization_members (organization_id, user_id, role)
            values (%s, %s, 'owner'), (%s, %s, 'member'), (%s, %s, 'owner')""",
            (organization_a, owner_id, organization_a, member_id, organization_b, outsider_id),
        )
        await fixtures.execute(
            """insert into public.customers (id, organization_id, name, created_by, updated_by)
            values (%s, %s, 'A customer', %s, %s), (%s, %s, 'B customer', %s, %s)""",
            (
                customer_a,
                organization_a,
                owner_id,
                owner_id,
                customer_b,
                organization_b,
                outsider_id,
                outsider_id,
            ),
        )
        await fixtures.execute(
            """insert into public.pipeline_stages
            (id, organization_id, name, color, position, kind)
            values (%s, %s, 'Lead', '#64748B', 1, 'open'),
                   (%s, %s, 'Lead', '#64748B', 1, 'open')""",
            (stage_a, organization_a, stage_b, organization_b),
        )
        await fixtures.execute(
            """insert into public.deals
            (id, organization_id, customer_id, stage_id, title, value_minor, currency,
             created_by, updated_by)
            values (%s, %s, %s, %s, 'Tenant A deal', 10000, 'USD', %s, %s),
                   (%s, %s, %s, %s, 'Tenant B deal', 20000, 'USD', %s, %s)""",
            (
                deal_a,
                organization_a,
                customer_a,
                stage_a,
                owner_id,
                owner_id,
                deal_b,
                organization_b,
                customer_b,
                stage_b,
                outsider_id,
                outsider_id,
            ),
        )
        await fixtures.commit()
        engine = create_database_engine(
            Settings(
                database_url=str(LIVE_ENV.DATABASE_URL),
                supabase_url=str(LIVE_ENV.SUPABASE_URL),
            )
        )
        try:
            await validate_runtime_role(engine)
            factory = create_session_factory(engine)
            async with rls_transaction(factory, member_id) as session:
                pipeline = await get_pipeline(session, organization_a)
                assert [deal.id for deal in pipeline.deals] == [deal_a]
                assert await get_deal(session, organization_b, deal_b) is None
                changed = await session.execute(
                    text(
                        "update public.deals set title = 'forbidden' "
                        "where id = :deal_id returning id"
                    ),
                    {"deal_id": deal_a},
                )
                assert changed.scalar_one_or_none() is None
        finally:
            await engine.dispose()
            await fixtures.execute(
                "delete from public.organizations where id in (%s, %s)",
                (organization_a, organization_b),
            )
            await fixtures.commit()
