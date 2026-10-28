import "server-only";

import { and, eq, gte, lt, ne, sql } from "drizzle-orm";

import { withUserContext } from "@/db/client";
import { expenseCategories, expenses } from "@/db/schema";
import { monthKeys } from "@/lib/analytics/buckets";
import type { AnalyticsRange } from "@/lib/analytics/range";
import { mergeExpenseTotals } from "@/lib/expenses/reports-model";

export function getExpenseReportsForUser(userId: string, organizationId: string, range: AnalyticsRange) {
  return withUserContext(userId, async (transaction) => {
    const where = and(eq(expenses.organizationId, organizationId), gte(expenses.expenseDate, range.start), lt(expenses.expenseDate, range.endExclusive), ne(expenses.status, "cancelled"));
    const [totals, monthlyRows, categoryRows] = await Promise.all([
      transaction.select({
        amountMinor: sql<number>`coalesce(sum(${expenses.amountMinor}), 0)::double precision`,
        currency: expenses.currency,
        paidMinor: sql<number>`coalesce(sum(case when ${expenses.status} in ('paid', 'reimbursed') then ${expenses.amountMinor} else 0 end), 0)::double precision`,
      }).from(expenses).where(where).groupBy(expenses.currency).orderBy(expenses.currency),
      transaction.select({
        amountMinor: sql<number>`coalesce(sum(${expenses.amountMinor}), 0)::double precision`,
        currency: expenses.currency,
        month: sql<string>`to_char(date_trunc('month', ${expenses.expenseDate}::timestamp), 'YYYY-MM')`,
      }).from(expenses).where(where).groupBy(sql`date_trunc('month', ${expenses.expenseDate}::timestamp)`, expenses.currency),
      transaction.select({
        amountMinor: sql<number>`coalesce(sum(${expenses.amountMinor}), 0)::double precision`,
        categoryId: expenseCategories.id,
        categoryName: expenseCategories.name,
        color: expenseCategories.color,
        currency: expenses.currency,
      }).from(expenses).innerJoin(expenseCategories, and(eq(expenseCategories.id, expenses.categoryId), eq(expenseCategories.organizationId, expenses.organizationId))).where(where).groupBy(expenseCategories.id, expenseCategories.name, expenseCategories.color, expenses.currency).orderBy(expenses.currency, expenseCategories.name),
    ]);
    const months = monthKeys(range.start, range.end);
    const currencies = [...new Set(monthlyRows.map((row) => row.currency))].sort();
    return {
      totals: mergeExpenseTotals(totals),
      monthly: currencies.map((currency) => ({ currency, points: months.map((month) => ({ month, amountMinor: monthlyRows.find((row) => row.currency === currency && row.month === month)?.amountMinor ?? 0 })) })),
      categories: categoryRows,
    };
  });
}
