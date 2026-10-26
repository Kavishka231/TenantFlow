import "server-only";

import { and, eq, gte, lt, ne, sql } from "drizzle-orm";

import { withUserContext } from "@/db/client";
import { invoices, paymentRecords } from "@/db/schema";
import { buildMonthlyFinancialSeries, monthKeys } from "@/lib/analytics/buckets";
import type { AnalyticsRange } from "@/lib/analytics/range";

export function getMonthlyFinancialAnalyticsForUser(
  userId: string,
  organizationId: string,
  range: AnalyticsRange,
) {
  return withUserContext(userId, async (transaction) => {
    const [invoiced, paid] = await Promise.all([
      transaction.select({
        month: sql<string>`to_char(date_trunc('month', ${invoices.issueDate}::timestamp), 'YYYY-MM')`,
        currency: invoices.currency,
        amountMinor: sql<number>`coalesce(sum(${invoices.totalMinor}), 0)::double precision`,
      }).from(invoices).where(and(
        eq(invoices.organizationId, organizationId),
        gte(invoices.issueDate, range.start),
        lt(invoices.issueDate, range.endExclusive),
        ne(invoices.status, "cancelled"),
      )).groupBy(sql`date_trunc('month', ${invoices.issueDate}::timestamp)`, invoices.currency),
      transaction.select({
        month: sql<string>`to_char(date_trunc('month', ${paymentRecords.paymentDate}::timestamp), 'YYYY-MM')`,
        currency: invoices.currency,
        amountMinor: sql<number>`coalesce(sum(${paymentRecords.amountMinor}), 0)::double precision`,
      }).from(paymentRecords).innerJoin(invoices, and(
        eq(invoices.id, paymentRecords.invoiceId),
        eq(invoices.organizationId, paymentRecords.organizationId),
      )).where(and(
        eq(paymentRecords.organizationId, organizationId),
        gte(paymentRecords.paymentDate, range.start),
        lt(paymentRecords.paymentDate, range.endExclusive),
      )).groupBy(sql`date_trunc('month', ${paymentRecords.paymentDate}::timestamp)`, invoices.currency),
    ]);
    return buildMonthlyFinancialSeries(monthKeys(range.start, range.end), invoiced, paid);
  });
}
