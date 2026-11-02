from uuid import uuid4

import psycopg
import pytest
from sqlalchemy import text

from app.core.config import Settings
from app.customers.schemas import CustomerSort
from app.customers.service import get_customer, list_customers
from app.db.session import (
    create_database_engine,
    create_session_factory,
    rls_transaction,
    validate_runtime_role,
)
from tests.integration.config import parse_live_test_config

LIVE_ENV = parse_live_test_config()
pytestmark = pytest.mark.skipif(
    LIVE_ENV is None,
    reason="live RLS credentials and disposable test identities are not configured",
)


async def test_customer_rls_denies_cross_tenant_reads_and_writes() -> None:
    assert LIVE_ENV is not None
    owner_id = LIVE_ENV.RLS_TEST_OWNER_ID
    member_id = LIVE_ENV.RLS_TEST_MEMBER_ID
    outsider_id = LIVE_ENV.RLS_TEST_OUTSIDER_ID
    organization_a = uuid4()
    organization_b = uuid4()
    customer_a = uuid4()
    customer_b = uuid4()

    async with await psycopg.AsyncConnection.connect(
        str(LIVE_ENV.MIGRATION_DATABASE_URL)
    ) as fixtures:
        await fixtures.execute(
            """
            insert into public.organizations (id, name, slug, created_by)
            values (%s, 'Customer RLS A', %s, %s),
                   (%s, 'Customer RLS B', %s, %s)
            """,
            (
                organization_a,
                f"customer-rls-a-{organization_a}",
                owner_id,
                organization_b,
                f"customer-rls-b-{organization_b}",
                outsider_id,
            ),
        )
        await fixtures.execute(
            """
            insert into public.organization_members (organization_id, user_id, role)
            values (%s, %s, 'owner'), (%s, %s, 'member'), (%s, %s, 'owner')
            """,
            (
                organization_a,
                owner_id,
                organization_a,
                member_id,
                organization_b,
                outsider_id,
            ),
        )
        await fixtures.execute(
            """
            insert into public.customers
              (id, organization_id, name, created_by, updated_by)
            values (%s, %s, 'Tenant A customer', %s, %s),
                   (%s, %s, 'Tenant B customer', %s, %s)
            """,
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
        await fixtures.commit()

        settings = Settings(
            database_url=str(LIVE_ENV.DATABASE_URL),
            supabase_url=str(LIVE_ENV.SUPABASE_URL),
        )
        engine = create_database_engine(settings)
        try:
            await validate_runtime_role(engine)
            factory = create_session_factory(engine)
            async with rls_transaction(factory, member_id) as session:
                own = await list_customers(
                    session,
                    organization_a,
                    page=1,
                    page_size=10,
                    query="",
                    sort=CustomerSort.NAME_ASC,
                    status=None,
                )
                assert [customer.id for customer in own.customers] == [customer_a]
                assert await get_customer(session, organization_b, customer_b) is None

            async with rls_transaction(factory, member_id) as session:
                member_update = await session.execute(
                    text(
                        "update public.customers set name = 'forbidden' "
                        "where id = :customer_id returning id"
                    ),
                    {"customer_id": customer_a},
                )
                assert member_update.scalar_one_or_none() is None

            async with rls_transaction(factory, owner_id) as session:
                cross_tenant_update = await session.execute(
                    text(
                        "update public.customers set name = 'cross tenant' "
                        "where id = :customer_id returning id"
                    ),
                    {"customer_id": customer_b},
                )
                assert cross_tenant_update.scalar_one_or_none() is None
        finally:
            await engine.dispose()
            await fixtures.execute(
                "delete from public.organizations where id in (%s, %s)",
                (organization_a, organization_b),
            )
            await fixtures.commit()
