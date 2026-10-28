import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { z } from "zod";

import { getServerEnv } from "@/lib/env/server";

const globalForDatabase = globalThis as unknown as {
  tenantFlowSql?: ReturnType<typeof postgres>;
  tenantFlowWebhookSql?: ReturnType<typeof postgres>;
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

export async function withWebhookTransaction<T>(
  operation: (transaction: DatabaseTransaction) => Promise<T>,
) {
  const webhookUrl = z.string().startsWith("postgresql://").parse(
    process.env.STRIPE_WEBHOOK_DATABASE_URL,
  );
  const client = globalForDatabase.tenantFlowWebhookSql ?? postgres(webhookUrl, {
    max: 2,
    prepare: false,
  });
  if (process.env.NODE_ENV !== "production") globalForDatabase.tenantFlowWebhookSql = client;
  const database = drizzle({ client });
  return database.transaction(async (transaction) => {
    const verification = await transaction.execute(sql`
      select
        pg_has_role(current_user, 'tenantflow_stripe_webhook', 'member') as capability,
        rolbypassrls as "bypassRls",
        rolsuper as superuser
      from pg_roles where rolname = current_user
    `);
    const role = verification[0] as { capability?: boolean; bypassRls?: boolean; superuser?: boolean } | undefined;
    if (!role?.capability || role.bypassRls || role.superuser) {
      throw new Error("Stripe webhook database role is not safely configured.");
    }
    return operation(transaction);
  });
}
