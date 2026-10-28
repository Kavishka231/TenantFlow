import "server-only";

import { and, asc, count, desc, eq, gte, lt, sql } from "drizzle-orm";

import { withUserContext } from "@/db/client";
import { customers, invoices, paymentRecords } from "@/db/schema";
import { monthKeys } from "@/lib/analytics/buckets";
import { buildCustomerGrowth, mergeRecentActivity } from "@/lib/analytics/models";
import type { AnalyticsRange } from "@/lib/analytics/range";
import { formatMinorUnits } from "@/lib/invoices/money";

export function getDashboardInsightsForUser(
  userId: string,
  organizationId: string,
  range: AnalyticsRange,
) {
  return withUserContext(userId, async (transaction) => {
    const start = new Date(`${range.start}T00:00:00.000Z`);
    const endExclusive = new Date(`${range.endExclusive}T00:00:00.000Z`);
    const effectiveStatus = sql<string>`case
      when ${invoices.status} = 'sent' and ${invoices.dueDate} < ${range.end}
        and ${invoices.paidMinor} < ${invoices.totalMinor} then 'overdue'
      else ${invoices.status}::text end`;

    const [baselineRows, growthRows, statusRows, recentCustomers, recentInvoices, recentPayments] = await Promise.all([
      transaction.select({ value: count() }).from(customers).where(and(
        eq(customers.organizationId, organizationId), lt(customers.createdAt, start),
      )),
      transaction.select({
        month: sql<string>`to_char(date_trunc('month', ${customers.createdAt}), 'YYYY-MM')`,
        count: count(),
      }).from(customers).where(and(
        eq(customers.organizationId, organizationId),
        gte(customers.createdAt, start), lt(customers.createdAt, endExclusive),
      )).groupBy(sql`date_trunc('month', ${customers.createdAt})`).orderBy(asc(sql`date_trunc('month', ${customers.createdAt})`)),
      transaction.select({ status: effectiveStatus, count: count() }).from(invoices).where(and(
        eq(invoices.organizationId, organizationId),
        gte(invoices.issueDate, range.start), lt(invoices.issueDate, range.endExclusive),
      )).groupBy(effectiveStatus),
      transaction.select({ id: customers.id, name: customers.name, occurredAt: customers.createdAt })
        .from(customers).where(and(eq(customers.organizationId, organizationId), gte(customers.createdAt, start), lt(customers.createdAt, endExclusive)))
        .orderBy(desc(customers.createdAt)).limit(8),
      transaction.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, occurredAt: invoices.createdAt })
        .from(invoices).where(and(eq(invoices.organizationId, organizationId), gte(invoices.createdAt, start), lt(invoices.createdAt, endExclusive)))
        .orderBy(desc(invoices.createdAt)).limit(8),
      transaction.select({
        id: paymentRecords.id, amountMinor: paymentRecords.amountMinor, currency: invoices.currency,
        invoiceNumber: invoices.invoiceNumber, occurredAt: paymentRecords.createdAt,
      }).from(paymentRecords).innerJoin(invoices, and(
        eq(invoices.id, paymentRecords.invoiceId), eq(invoices.organizationId, paymentRecords.organizationId),
      )).where(and(eq(paymentRecords.organizationId, organizationId), gte(paymentRecords.createdAt, start), lt(paymentRecords.createdAt, endExclusive)))
        .orderBy(desc(paymentRecords.createdAt)).limit(8),
    ]);

    return {
      customerGrowth: buildCustomerGrowth(monthKeys(range.start, range.end), baselineRows[0]?.value ?? 0, growthRows),
      invoiceStatuses: statusRows.sort((a, b) => a.status.localeCompare(b.status)),
      recentActivity: mergeRecentActivity([
        recentCustomers.map((row) => ({ id: row.id, type: "customer_created" as const, title: "Customer added", description: row.name, occurredAt: row.occurredAt })),
        recentInvoices.map((row) => ({ id: row.id, type: "invoice_created" as const, title: "Invoice created", description: row.invoiceNumber, occurredAt: row.occurredAt })),
        recentPayments.map((row) => ({ id: row.id, type: "payment_recorded" as const, title: "Payment recorded", description: `${formatMinorUnits(row.amountMinor, row.currency)} · ${row.invoiceNumber}`, occurredAt: row.occurredAt })),
      ]),
    };
  });
}
