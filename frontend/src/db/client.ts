import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getServerEnv } from "@/lib/env/server";

const globalForDatabase = globalThis as unknown as {
  tenantFlowSql?: ReturnType<typeof postgres>;
};

function getSqlClient() {
  if (globalForDatabase.tenantFlowSql) {
    return globalForDatabase.tenantFlowSql;
  }

  const sql = postgres(getServerEnv().DATABASE_URL, {
    max: 10,
    prepare: false,
  });

  if (process.env.NODE_ENV !== "production") {
    globalForDatabase.tenantFlowSql = sql;
  }

  return sql;
}

/**
 * Server-only application connection. The configured PostgreSQL role must not
 * own tenant tables or have BYPASSRLS. Callers still need an authenticated
 * transaction context; importing Drizzle never provides tenant isolation.
 */
export const db = drizzle({ client: getSqlClient() });
