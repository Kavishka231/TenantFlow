import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  or,
  type SQL,
  sql,
} from "drizzle-orm";

import { withUserContext } from "@/db/client";
import { customers } from "@/db/schema";
import {
  customerListOffset,
  type CustomerListQuery,
} from "@/lib/customers/query";

function customerOrder(query: CustomerListQuery) {
  switch (query.sort) {
    case "name_desc":
      return [desc(customers.name), desc(customers.id)] as const;
    case "newest":
      return [desc(customers.createdAt), desc(customers.id)] as const;
    case "oldest":
      return [asc(customers.createdAt), asc(customers.id)] as const;
    case "recently_updated":
      return [desc(customers.updatedAt), desc(customers.id)] as const;
    default:
      return [asc(customers.name), asc(customers.id)] as const;
  }
}

function customerFilters(
  organizationId: string,
  query: CustomerListQuery,
) {
  const conditions: SQL[] = [eq(customers.organizationId, organizationId)];

  if (query.status !== "all") {
    conditions.push(eq(customers.status, query.status));
  }

  if (query.q) {
    const search = query.q.toLowerCase();
    conditions.push(
      or(
        sql`position(${search} in lower(${customers.name})) > 0`,
        sql`position(${search} in lower(coalesce(${customers.email}, ''))) > 0`,
        sql`position(${search} in lower(coalesce(${customers.phone}, ''))) > 0`,
        sql`position(${search} in lower(coalesce(${customers.company}, ''))) > 0`,
      )!,
    );
  }

  return and(...conditions)!;
}

export function listCustomersForUser(
  userId: string,
  organizationId: string,
  query: CustomerListQuery,
) {
  return withUserContext(userId, async (transaction) => {
    const where = customerFilters(organizationId, query);
    const [rows, totalResult] = await Promise.all([
      transaction
        .select({
          company: customers.company,
          createdAt: customers.createdAt,
          email: customers.email,
          id: customers.id,
          name: customers.name,
          phone: customers.phone,
          status: customers.status,
          updatedAt: customers.updatedAt,
        })
        .from(customers)
        .where(where)
        .orderBy(...customerOrder(query))
        .limit(query.pageSize)
        .offset(customerListOffset(query)),
      transaction
        .select({ value: count() })
        .from(customers)
        .where(where),
    ]);

    const total = totalResult[0]?.value ?? 0;

    return {
      customers: rows,
      page: query.page,
      pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
      pageSize: query.pageSize,
      total,
    };
  });
}

export type CustomerListResult = Awaited<
  ReturnType<typeof listCustomersForUser>
>;
