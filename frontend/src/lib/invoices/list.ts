import "server-only";

import { and, asc, count, desc, eq, gte, lt, or, type SQL, sql } from "drizzle-orm";

import { withUserContext } from "@/db/client";
import { customers, invoices } from "@/db/schema";
import type { InvoiceListQuery } from "@/lib/invoices/query";

function filters(organizationId: string, query: InvoiceListQuery) {
  const conditions: SQL[] = [eq(invoices.organizationId, organizationId)];
  const today = new Date().toISOString().slice(0, 10);
  if (query.status === "overdue") {
    conditions.push(or(eq(invoices.status, "overdue"), and(eq(invoices.status, "sent"), lt(invoices.dueDate, today)))!);
  } else if (query.status === "sent") {
    conditions.push(and(eq(invoices.status, "sent"), gte(invoices.dueDate, today))!);
  } else if (query.status !== "all") {
    conditions.push(eq(invoices.status, query.status));
  }
  if (query.q) {
    const search = query.q.toLowerCase();
    conditions.push(or(
      sql`position(${search} in lower(${invoices.invoiceNumber})) > 0`,
      sql`position(${search} in lower(${customers.name})) > 0`,
      sql`position(${search} in lower(coalesce(${customers.company}, ''))) > 0`,
    )!);
  }
  return and(...conditions)!;
}

function order(query: InvoiceListQuery) {
  if (query.sort === "oldest") return [asc(invoices.issueDate), asc(invoices.id)] as const;
  if (query.sort === "due_soon") return [asc(invoices.dueDate), asc(invoices.id)] as const;
  if (query.sort === "amount_high") return [desc(invoices.totalMinor), desc(invoices.id)] as const;
  return [desc(invoices.issueDate), desc(invoices.id)] as const;
}

export function listInvoicesForUser(userId: string, organizationId: string, query: InvoiceListQuery) {
  return withUserContext(userId, async (transaction) => {
    const where = filters(organizationId, query);
    const base = transaction
      .select({
        currency: invoices.currency,
        customerName: customers.name,
        dueDate: invoices.dueDate,
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        issueDate: invoices.issueDate,
        paidMinor: invoices.paidMinor,
        status: invoices.status,
        totalMinor: invoices.totalMinor,
      })
      .from(invoices)
      .innerJoin(customers, and(eq(customers.id, invoices.customerId), eq(customers.organizationId, invoices.organizationId)));
    const [rows, totals] = await Promise.all([
      base.where(where).orderBy(...order(query)).limit(query.pageSize).offset((query.page - 1) * query.pageSize),
      transaction.select({ value: count() }).from(invoices).innerJoin(customers, and(eq(customers.id, invoices.customerId), eq(customers.organizationId, invoices.organizationId))).where(where),
    ]);
    const total = totals[0]?.value ?? 0;
    return { invoices: rows, page: query.page, pageCount: Math.max(1, Math.ceil(total / query.pageSize)), total };
  });
}

export function listInvoiceCustomersForUser(userId: string, organizationId: string) {
  return withUserContext(userId, (transaction) =>
    transaction.select({ company: customers.company, id: customers.id, name: customers.name })
      .from(customers)
      .where(eq(customers.organizationId, organizationId))
      .orderBy(asc(customers.name))
      .limit(500),
  );
}
