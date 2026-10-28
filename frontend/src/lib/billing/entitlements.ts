import "server-only";

import { count, eq, sql } from "drizzle-orm";

import type { DatabaseTransaction } from "@/db/client";
import { customers, invoices } from "@/db/schema";

export class PlanLimitError extends Error {
  constructor(resource: "customers" | "invoices") {
    super(`This workspace has reached its plan limit for ${resource}.`);
    this.name = "PlanLimitError";
  }
}

export async function assertResourceCapacity(
  transaction: DatabaseTransaction,
  organizationId: string,
  resource: "customers" | "invoices",
) {
  await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${organizationId}, 7281))`);
  const entitlements = await transaction.execute(sql`
    select plan_key, max_customers, max_invoices
    from public.get_organization_entitlements(${organizationId}::uuid)
  `);
  const row = entitlements[0] as {
    max_customers: number | null;
    max_invoices: number | null;
    plan_key: string;
  } | undefined;
  if (!row) throw new PlanLimitError(resource);
  const limit = resource === "customers" ? row.max_customers : row.max_invoices;
  if (limit == null) return row.plan_key;
  const table = resource === "customers" ? customers : invoices;
  const [usage] = await transaction
    .select({ value: count() })
    .from(table)
    .where(eq(table.organizationId, organizationId));
  if ((usage?.value ?? 0) >= limit) throw new PlanLimitError(resource);
  return row.plan_key;
}
