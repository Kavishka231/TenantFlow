import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { z } from "zod";

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
function getDatabase() {
  return drizzle({ client: getSqlClient() });
}

export type DatabaseTransaction = Parameters<
  Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]
>[0];

export async function withUserContext<T>(
  userId: string,
  operation: (transaction: DatabaseTransaction) => Promise<T>,
) {
  const validatedUserId = z.uuid().parse(userId);

  return getDatabase().transaction(async (transaction) => {
    const claims = JSON.stringify({ sub: validatedUserId, role: "authenticated" });

    await transaction.execute(sql`
      select
        set_config('request.jwt.claim.sub', ${validatedUserId}, true),
        set_config('request.jwt.claims', ${claims}, true)
    `);

    return operation(transaction);
  });
}

/**
 * Runs a server-verified system operation without end-user JWT claims. Keep
 * callers limited to cryptographically authenticated integrations such as the
 * Stripe webhook; tenant mutations must still go through constrained database
 * functions rather than direct table writes.
 */
export function withSystemTransaction<T>(
  operation: (transaction: DatabaseTransaction) => Promise<T>,
) {
  return getDatabase().transaction(operation);
}
