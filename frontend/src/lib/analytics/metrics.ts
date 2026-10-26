import "server-only";

import { and, count, eq, gte, lt, ne, or, sql } from "drizzle-orm";

import { withUserContext } from "@/db/client";
import { customers, invoices, paymentRecords } from "@/db/schema";
import type { AnalyticsRange } from "@/lib/analytics/range";

export type CurrencyMetric = { currency: string; amountMinor: number };

export type DashboardMetrics = {
  totalCustomers: number;
  totalInvoices: number;
  overdueInvoices: number;
  paidAmounts: CurrencyMetric[];
  outstandingBalances: CurrencyMetric[];
};

export function getDashboardMetricsForUser(
  userId: string,
  organizationId: string,
  range: AnalyticsRange,
): Promise<DashboardMetrics> {
  return withUserContext(userId, async (transaction) => {
    const invoiceRange = and(
      eq(invoices.organizationId, organizationId),
      gte(invoices.issueDate, range.start),
      lt(invoices.issueDate, range.endExclusive),
    );
    const [customerRows, invoiceRows, overdueRows, paidAmounts, outstandingBalances] = await Promise.all([
      transaction.select({ value: count() }).from(customers).where(eq(customers.organizationId, organizationId)),
      transaction.select({ value: count() }).from(invoices).where(invoiceRange),
      transaction.select({ value: count() }).from(invoices).where(and(
        invoiceRange,
        lt(invoices.dueDate, range.endExclusive),
        or(eq(invoices.status, "overdue"), eq(invoices.status, "sent")),
        sql`${invoices.paidMinor} < ${invoices.totalMinor}`,
      )),
      transaction.select({
        currency: invoices.currency,
        amountMinor: sql<number>`coalesce(sum(${paymentRecords.amountMinor}), 0)::double precision`,
      }).from(paymentRecords).innerJoin(invoices, and(
        eq(invoices.id, paymentRecords.invoiceId),
        eq(invoices.organizationId, paymentRecords.organizationId),
      )).where(and(
        eq(paymentRecords.organizationId, organizationId),
        gte(paymentRecords.paymentDate, range.start),
        lt(paymentRecords.paymentDate, range.endExclusive),
      )).groupBy(invoices.currency).orderBy(invoices.currency),
      transaction.select({
        currency: invoices.currency,
        amountMinor: sql<number>`coalesce(sum(${invoices.totalMinor} - ${invoices.paidMinor}), 0)::double precision`,
      }).from(invoices).where(and(invoiceRange, ne(invoices.status, "cancelled"))).groupBy(invoices.currency).orderBy(invoices.currency),
    ]);

    return {
      totalCustomers: customerRows[0]?.value ?? 0,
      totalInvoices: invoiceRows[0]?.value ?? 0,
      overdueInvoices: overdueRows[0]?.value ?? 0,
      paidAmounts,
      outstandingBalances,
    };
  });
}
