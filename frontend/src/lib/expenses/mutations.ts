import "server-only";

import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import { withUserContext, type DatabaseTransaction } from "@/db/client";
import { expenseCategories, expenses } from "@/db/schema";
import type { changeExpenseStatusSchema, createExpenseSchema, deleteExpenseSchema, updateExpenseSchema } from "@/lib/expenses/validation";

export class ExpenseConflictError extends Error {
  constructor(message = "This expense changed since the page was loaded. Refresh and try again.") {
    super(message);
    this.name = "ExpenseConflictError";
  }
}

async function requireTenantCategory(transaction: DatabaseTransaction, organizationId: string, categoryId: string) {
  const [category] = await transaction.select({ id: expenseCategories.id }).from(expenseCategories).where(and(
    eq(expenseCategories.id, categoryId),
    eq(expenseCategories.organizationId, organizationId),
  )).limit(1);
  if (!category) throw new ExpenseConflictError("Select a category from this workspace.");
}

export function createExpenseForUser(userId: string, input: z.infer<typeof createExpenseSchema>) {
  return withUserContext(userId, async (transaction) => {
    await requireTenantCategory(transaction, input.organizationId, input.categoryId);
    const [expense] = await transaction.insert(expenses).values({
      amountMinor: input.amountMinor,
      categoryId: input.categoryId,
      createdBy: userId,
      currency: input.currency,
      description: input.description,
      expenseDate: input.expenseDate,
      organizationId: input.organizationId,
      paidDate: input.paidDate,
      paymentMethod: input.paymentMethod,
      status: input.status,
      updatedBy: userId,
      vendor: input.vendor,
    }).returning({ id: expenses.id });
    if (!expense) throw new Error("The expense could not be created.");
    return expense;
  });
}

export function updateExpenseForUser(userId: string, input: z.infer<typeof updateExpenseSchema>) {
  return withUserContext(userId, async (transaction) => {
    await requireTenantCategory(transaction, input.organizationId, input.categoryId);
    const [expense] = await transaction.update(expenses).set({
      amountMinor: input.amountMinor,
      categoryId: input.categoryId,
      currency: input.currency,
      description: input.description,
      expenseDate: input.expenseDate,
      paidDate: input.paidDate,
      paymentMethod: input.paymentMethod,
      status: input.status,
      updatedBy: userId,
      vendor: input.vendor,
    }).where(and(
      eq(expenses.id, input.expenseId),
      eq(expenses.organizationId, input.organizationId),
      eq(expenses.version, input.version),
    )).returning({ id: expenses.id });
    if (!expense) throw new ExpenseConflictError();
    return expense;
  });
}

export function changeExpenseStatusForUser(userId: string, input: z.infer<typeof changeExpenseStatusSchema>) {
  return withUserContext(userId, async (transaction) => {
    const [expense] = await transaction.update(expenses).set({
      paidDate: input.paidDate,
      status: input.status,
      updatedBy: userId,
    }).where(and(eq(expenses.id, input.expenseId), eq(expenses.organizationId, input.organizationId), eq(expenses.version, input.version))).returning({ id: expenses.id });
    if (!expense) throw new ExpenseConflictError();
    return expense;
  });
}

export function deleteExpenseForUser(userId: string, input: z.infer<typeof deleteExpenseSchema>) {
  return withUserContext(userId, async (transaction) => {
    const [expense] = await transaction.delete(expenses).where(and(
      eq(expenses.id, input.expenseId),
      eq(expenses.organizationId, input.organizationId),
      eq(expenses.version, input.version),
    )).returning({ id: expenses.id, receiptPath: expenses.receiptPath });
    if (!expense) throw new ExpenseConflictError();
    return expense;
  });
}
