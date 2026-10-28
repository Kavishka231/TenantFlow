import "server-only";

import { and, asc, count, desc, eq, or, sql, type SQL } from "drizzle-orm";

import { withUserContext } from "@/db/client";
import { expenseCategories, expenses } from "@/db/schema";
import { expenseListOffset, type ExpenseListQuery } from "@/lib/expenses/query";

function filters(organizationId: string, query: ExpenseListQuery) {
  const conditions: SQL[] = [eq(expenses.organizationId, organizationId)];
  if (query.categoryId !== "all") conditions.push(eq(expenses.categoryId, query.categoryId));
  if (query.status !== "all") conditions.push(eq(expenses.status, query.status));
  if (query.paymentMethod !== "all") conditions.push(eq(expenses.paymentMethod, query.paymentMethod));
  if (query.q) {
    const search = query.q.toLowerCase();
    conditions.push(or(
      sql`position(${search} in lower(${expenses.vendor})) > 0`,
      sql`position(${search} in lower(coalesce(${expenses.description}, ''))) > 0`,
    )!);
  }
  return and(...conditions)!;
}

function order(query: ExpenseListQuery) {
  switch (query.sort) {
    case "oldest": return [asc(expenses.expenseDate), asc(expenses.id)] as const;
    case "amount_desc": return [desc(expenses.amountMinor), desc(expenses.id)] as const;
    case "amount_asc": return [asc(expenses.amountMinor), asc(expenses.id)] as const;
    case "vendor_asc": return [asc(expenses.vendor), asc(expenses.id)] as const;
    case "vendor_desc": return [desc(expenses.vendor), desc(expenses.id)] as const;
    default: return [desc(expenses.expenseDate), desc(expenses.createdAt), desc(expenses.id)] as const;
  }
}

export function listExpensesForUser(userId: string, organizationId: string, query: ExpenseListQuery) {
  return withUserContext(userId, async (transaction) => {
    const where = filters(organizationId, query);
    const [rows, totalRows] = await Promise.all([
      transaction.select({
        amountMinor: expenses.amountMinor,
        categoryColor: expenseCategories.color,
        categoryName: expenseCategories.name,
        currency: expenses.currency,
        expenseDate: expenses.expenseDate,
        id: expenses.id,
        paymentMethod: expenses.paymentMethod,
        receiptName: expenses.receiptName,
        status: expenses.status,
        vendor: expenses.vendor,
      }).from(expenses).innerJoin(expenseCategories, and(
        eq(expenseCategories.id, expenses.categoryId),
        eq(expenseCategories.organizationId, expenses.organizationId),
      )).where(where).orderBy(...order(query)).limit(query.pageSize).offset(expenseListOffset(query)),
      transaction.select({ value: count() }).from(expenses).where(where),
    ]);
    const total = totalRows[0]?.value ?? 0;
    return { expenses: rows, page: query.page, pageCount: Math.max(1, Math.ceil(total / query.pageSize)), pageSize: query.pageSize, total };
  });
}
