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
from app.expenses.service import get_expense, list_categories
from tests.integration.config import parse_live_test_config

LIVE_ENV = parse_live_test_config()
pytestmark = pytest.mark.skipif(
    LIVE_ENV is None,
    reason="live RLS credentials and disposable test identities are not configured",
)


async def test_expense_rls_allows_member_reads_but_denies_mutation_and_cross_tenant() -> None:
    assert LIVE_ENV is not None
    owner_id, member_id, outsider_id = (
        LIVE_ENV.RLS_TEST_OWNER_ID,
        LIVE_ENV.RLS_TEST_MEMBER_ID,
        LIVE_ENV.RLS_TEST_OUTSIDER_ID,
    )
    organization_a, organization_b = uuid4(), uuid4()
    category_a, category_b, expense_a, expense_b = uuid4(), uuid4(), uuid4(), uuid4()
    async with await psycopg.AsyncConnection.connect(
        str(LIVE_ENV.MIGRATION_DATABASE_URL)
    ) as fixtures:
        await fixtures.execute(
            """insert into public.organizations (id,name,slug,created_by) values
            (%s,'Expense RLS A',%s,%s),(%s,'Expense RLS B',%s,%s)""",
            (
                organization_a,
                f"expense-rls-a-{organization_a}",
                owner_id,
                organization_b,
                f"expense-rls-b-{organization_b}",
                outsider_id,
            ),
        )
        await fixtures.execute(
            """insert into public.organization_members (organization_id,user_id,role) values
            (%s,%s,'owner'),(%s,%s,'member'),(%s,%s,'owner')""",
            (organization_a, owner_id, organization_a, member_id, organization_b, outsider_id),
        )
        await fixtures.execute(
            """insert into public.expense_categories (id,organization_id,name,color) values
            (%s,%s,'Travel','#F59E0B'),(%s,%s,'Travel','#F59E0B')""",
            (category_a, organization_a, category_b, organization_b),
        )
        await fixtures.execute(
            """insert into public.expenses
            (id,organization_id,category_id,amount_minor,currency,expense_date,vendor,
             payment_method,status,created_by,updated_by) values
            (%s,%s,%s,1000,'USD','2026-11-01','Tenant A','card','pending',%s,%s),
            (%s,%s,%s,2000,'USD','2026-11-01','Tenant B','card','pending',%s,%s)""",
            (
                expense_a,
                organization_a,
                category_a,
                owner_id,
                owner_id,
                expense_b,
                organization_b,
                category_b,
                outsider_id,
                outsider_id,
            ),
        )
        await fixtures.commit()
        engine = create_database_engine(
            Settings(
                database_url=str(LIVE_ENV.DATABASE_URL), supabase_url=str(LIVE_ENV.SUPABASE_URL)
            )
        )
        try:
            await validate_runtime_role(engine)
            factory = create_session_factory(engine)
            async with rls_transaction(factory, member_id) as session:
                assert [
                    category.id for category in await list_categories(session, organization_a)
                ] == [category_a]
                assert (await get_expense(session, organization_a, expense_a)) is not None
                assert await get_expense(session, organization_b, expense_b) is None
                changed = await session.execute(
                    text("update public.expenses set vendor='forbidden' where id=:id returning id"),
                    {"id": expense_a},
                )
                assert changed.scalar_one_or_none() is None
        finally:
            await engine.dispose()
            await fixtures.execute(
                "delete from public.organizations where id in (%s,%s)",
                (organization_a, organization_b),
            )
            await fixtures.commit()
