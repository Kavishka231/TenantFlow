import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { withUserContext } from "@/db/client";
import { expenseCategories, expenses } from "@/db/schema";

export function listExpenseCategoriesForUser(userId: string, organizationId: string) {
  return withUserContext(userId, (transaction) => transaction.select({
    color: expenseCategories.color,
    id: expenseCategories.id,
    name: expenseCategories.name,
  }).from(expenseCategories).where(eq(expenseCategories.organizationId, organizationId)).orderBy(asc(expenseCategories.name)));
}

export function getExpenseForUser(userId: string, organizationId: string, expenseId: string) {
  const identity = z.object({ organizationId: z.uuid(), expenseId: z.uuid() }).safeParse({ organizationId, expenseId });
  if (!identity.success) return null;
  return withUserContext(userId, async (transaction) => {
    const [expense] = await transaction.select({
      amountMinor: expenses.amountMinor,
      categoryColor: expenseCategories.color,
      categoryId: expenses.categoryId,
      categoryName: expenseCategories.name,
      createdAt: expenses.createdAt,
      currency: expenses.currency,
      description: expenses.description,
      expenseDate: expenses.expenseDate,
      id: expenses.id,
      paidDate: expenses.paidDate,
      paymentMethod: expenses.paymentMethod,
      receiptMimeType: expenses.receiptMimeType,
      receiptName: expenses.receiptName,
      receiptPath: expenses.receiptPath,
      receiptSize: expenses.receiptSize,
      status: expenses.status,
      updatedAt: expenses.updatedAt,
      vendor: expenses.vendor,
      version: expenses.version,
    }).from(expenses).innerJoin(expenseCategories, and(
      eq(expenseCategories.id, expenses.categoryId),
      eq(expenseCategories.organizationId, expenses.organizationId),
    )).where(and(eq(expenses.id, identity.data.expenseId), eq(expenses.organizationId, identity.data.organizationId))).limit(1);
    return expense ?? null;
  });
}
