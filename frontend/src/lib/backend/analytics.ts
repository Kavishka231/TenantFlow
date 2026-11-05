import "server-only";

import { z } from "zod";

import type { AnalyticsRange } from "@/lib/analytics/range";
import { backendRequest } from "@/lib/backend/client";
import { getMonthlyFinancialAnalyticsForUser } from "@/lib/analytics/financial";
import { getDashboardInsightsForUser } from "@/lib/analytics/insights";
import { getDashboardMetricsForUser } from "@/lib/analytics/metrics";

const currencySchema = z.object({ currency: z.string(), amount_minor: z.number().int() })
  .transform(({ amount_minor, ...value }) => ({ ...value, amountMinor: amount_minor }));
const responseSchema = z.object({
  metrics: z.object({
    total_customers: z.number().int(), total_invoices: z.number().int(), overdue_invoices: z.number().int(),
    paid_amounts: z.array(currencySchema), outstanding_balances: z.array(currencySchema),
  }),
  financial: z.array(z.object({ currency: z.string(), points: z.array(z.object({
    month: z.string(), invoiced_minor: z.number().int(), paid_minor: z.number().int(),
  }).transform(({ invoiced_minor, paid_minor, ...point }) => ({ ...point, invoicedMinor: invoiced_minor, paidMinor: paid_minor }))) })),
  insights: z.object({
    customer_growth: z.array(z.object({ month: z.string(), new_customers: z.number().int(), total_customers: z.number().int() })
      .transform(({ new_customers, total_customers, ...point }) => ({ ...point, newCustomers: new_customers, totalCustomers: total_customers }))),
    invoice_statuses: z.array(z.object({ status: z.string(), count: z.number().int() })),
    recent_activity: z.array(z.object({ id: z.uuid(), type: z.enum(["customer_created", "invoice_created", "payment_recorded"]), title: z.string(), description: z.string(), occurred_at: z.coerce.date() })
      .transform(({ occurred_at, ...activity }) => ({ ...activity, occurredAt: occurred_at }))),
  }),
}).transform(({ metrics, financial, insights }) => ({
  metrics: { totalCustomers: metrics.total_customers, totalInvoices: metrics.total_invoices,
    overdueInvoices: metrics.overdue_invoices, paidAmounts: metrics.paid_amounts,
    outstandingBalances: metrics.outstanding_balances },
  financial,
  insights: { customerGrowth: insights.customer_growth, invoiceStatuses: insights.invoice_statuses,
    recentActivity: insights.recent_activity },
}));

export async function getDashboardAnalyticsThroughBackend(userId: string, token: string | undefined, organizationId: string, range: AnalyticsRange) {
  const search = new URLSearchParams({ start: range.start, end_exclusive: range.endExclusive });
  const result = await backendRequest(`/api/v1/organizations/${organizationId}/analytics/dashboard?${search}`, token);
  if (result.enabled) return responseSchema.parse(result.data);
  const [metrics, financial, insights] = await Promise.all([
    getDashboardMetricsForUser(userId, organizationId, range),
    getMonthlyFinancialAnalyticsForUser(userId, organizationId, range),
    getDashboardInsightsForUser(userId, organizationId, range),
  ]);
  return { metrics, financial, insights };
}
