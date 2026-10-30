import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncConnection,
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import Settings

TENANT_TABLES = (
    "organizations",
    "organization_members",
    "customers",
    "invoices",
    "deals",
    "expenses",
)


class UnsafeRuntimeRoleError(RuntimeError):
    """Raised when DATABASE_URL could bypass TenantFlow's RLS boundary."""


@dataclass(frozen=True)
class RuntimeRoleState:
    authenticated_member: bool
    bypass_rls: bool
    owns_tenant_tables: bool
    superuser: bool


def create_database_engine(settings: Settings) -> AsyncEngine:
    return create_async_engine(
        settings.sqlalchemy_database_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
    )


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


async def read_runtime_role_state(connection: AsyncConnection) -> RuntimeRoleState:
    result = await connection.execute(
        text(
            """
            select
              pg_has_role(current_user, 'authenticated', 'member') as authenticated_member,
              role.rolbypassrls as bypass_rls,
              role.rolsuper as superuser,
              exists (
                select 1
                from pg_class table_class
                join pg_namespace namespace on namespace.oid = table_class.relnamespace
                where namespace.nspname = 'public'
                  and table_class.relname = any(:tenant_tables)
                  and pg_get_userbyid(table_class.relowner) = current_user
              ) as owns_tenant_tables
            from pg_roles role
            where role.rolname = current_user
            """
        ),
        {"tenant_tables": list(TENANT_TABLES)},
    )
    row = result.mappings().one()
    return RuntimeRoleState(
        authenticated_member=bool(row["authenticated_member"]),
        bypass_rls=bool(row["bypass_rls"]),
        owns_tenant_tables=bool(row["owns_tenant_tables"]),
        superuser=bool(row["superuser"]),
    )


def assert_safe_runtime_role(state: RuntimeRoleState) -> None:
    if (
        not state.authenticated_member
        or state.bypass_rls
        or state.owns_tenant_tables
        or state.superuser
    ):
        raise UnsafeRuntimeRoleError(
            "DATABASE_URL must use a non-owner, non-superuser, non-BYPASSRLS role "
            "that inherits authenticated."
        )


async def validate_runtime_role(engine: AsyncEngine) -> None:
    async with engine.connect() as connection:
        assert_safe_runtime_role(await read_runtime_role_state(connection))


def claims_for_user(user_id: UUID) -> str:
    return json.dumps(
        {"role": "authenticated", "sub": str(user_id)},
        separators=(",", ":"),
        sort_keys=True,
    )


async def set_authenticated_context(session: AsyncSession, user_id: UUID) -> None:
    await session.execute(
        text(
            """
            select
              set_config('request.jwt.claim.sub', :user_id, true),
              set_config('request.jwt.claims', :claims, true)
            """
        ),
        {"claims": claims_for_user(user_id), "user_id": str(user_id)},
    )


@asynccontextmanager
async def rls_transaction(
    session_factory: async_sessionmaker[AsyncSession], user_id: UUID
) -> AsyncIterator[AsyncSession]:
    """Set request identity inside the same transaction used for all tenant queries."""
    async with session_factory() as session, session.begin():
        await set_authenticated_context(session, user_id)
        yield session
