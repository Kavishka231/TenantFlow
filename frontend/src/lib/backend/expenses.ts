import "server-only";

import { z } from "zod";

import type { AnalyticsRange } from "@/lib/analytics/range";
import { BackendApiError, backendRequest } from "@/lib/backend/client";
import { getExpenseForUser, listExpenseCategoriesForUser } from "@/lib/expenses/data";
import { listExpensesForUser } from "@/lib/expenses/list";
import {
  attachExpenseReceiptForUser, changeExpenseStatusForUser, createExpenseForUser,
  deleteExpenseForUser, detachExpenseReceiptForUser, ExpenseConflictError, updateExpenseForUser,
} from "@/lib/expenses/mutations";
import type { ExpenseListQuery } from "@/lib/expenses/query";
import { getExpenseReportsForUser } from "@/lib/expenses/reports";
import type { changeExpenseStatusSchema, createExpenseSchema, deleteExpenseSchema, updateExpenseSchema } from "@/lib/expenses/validation";

type CreateInput = z.infer<typeof createExpenseSchema>;
type UpdateInput = z.infer<typeof updateExpenseSchema>;
type Identity = z.infer<typeof deleteExpenseSchema>;
type StatusInput = z.infer<typeof changeExpenseStatusSchema>;

const statusSchema = z.enum(["pending", "paid", "reimbursed", "cancelled"]);
const methodSchema = z.enum(["cash", "bank_transfer", "card", "check", "other"]);
const categorySchema = z.object({ id: z.uuid(), name: z.string(), color: z.string() });
const detailSchema = z.object({
  id: z.uuid(), organization_id: z.uuid(), category_id: z.uuid(), amount_minor: z.number().int(),
  currency: z.string(), expense_date: z.string(), vendor: z.string(), payment_method: methodSchema,
  status: statusSchema, paid_date: z.string().nullable(), description: z.string().nullable(),
  receipt_name: z.string().nullable(), receipt_mime_type: z.string().nullable(), receipt_size: z.number().int().nullable(),
  version: z.number().int(), created_at: z.coerce.date(), updated_at: z.coerce.date(),
  category_name: z.string(), category_color: z.string(),
}).transform(({ organization_id, category_id, amount_minor, expense_date, payment_method, paid_date, receipt_name, receipt_mime_type, receipt_size, created_at, updated_at, category_name, category_color, ...expense }) => ({
  ...expense, organizationId: organization_id, categoryId: category_id, amountMinor: amount_minor,
  expenseDate: expense_date, paymentMethod: payment_method, paidDate: paid_date, receiptName: receipt_name,
  receiptMimeType: receipt_mime_type, receiptSize: receipt_size, createdAt: created_at, updatedAt: updated_at,
  categoryName: category_name, categoryColor: category_color, receiptPath: null,
}));
const listItemSchema = z.object({
  id: z.uuid(), amount_minor: z.number().int(), currency: z.string(), expense_date: z.string(), vendor: z.string(),
  payment_method: methodSchema, status: statusSchema, receipt_name: z.string().nullable(), category_name: z.string(), category_color: z.string(),
}).transform(({ amount_minor, expense_date, payment_method, receipt_name, category_name, category_color, ...expense }) => ({
  ...expense, amountMinor: amount_minor, expenseDate: expense_date, paymentMethod: payment_method,
  receiptName: receipt_name, categoryName: category_name, categoryColor: category_color,
}));
const listSchema = z.object({ expenses: z.array(listItemSchema), page: z.number().int(), page_count: z.number().int(), page_size: z.number().int(), total: z.number().int() })
  .transform(({ page_count, page_size, ...result }) => ({ ...result, pageCount: page_count, pageSize: page_size }));
const totalSchema = z.object({ currency: z.string(), amount_minor: z.number().int(), paid_minor: z.number().int() })
  .transform(({ amount_minor, paid_minor, ...total }) => ({ ...total, amountMinor: amount_minor, paidMinor: paid_minor }));
const monthlySchema = z.object({ currency: z.string(), points: z.array(z.object({ month: z.string(), amount_minor: z.number().int() }).transform(({ amount_minor, ...point }) => ({ ...point, amountMinor: amount_minor }))) });
const categoryTotalSchema = z.object({ category_id: z.uuid(), category_name: z.string(), color: z.string(), currency: z.string(), amount_minor: z.number().int() })
  .transform(({ category_id, category_name, amount_minor, ...item }) => ({ ...item, categoryId: category_id, categoryName: category_name, amountMinor: amount_minor }));
const reportsSchema = z.object({ totals: z.array(totalSchema), monthly: z.array(monthlySchema), categories: z.array(categoryTotalSchema) });

function expenseBody(input: CreateInput | UpdateInput) { return {
  category_id: input.categoryId, amount_minor: input.amountMinor, currency: input.currency,
  expense_date: input.expenseDate, vendor: input.vendor, payment_method: input.paymentMethod,
  status: input.status, paid_date: input.paidDate, description: input.description,
}; }
async function mutate(path: string, token: string | undefined, method: string, body: unknown) {
  return backendRequest(path, token, { method, body: JSON.stringify(body) });
}
function translate(error: unknown): never { if (error instanceof BackendApiError && error.code === "expense_conflict") throw new ExpenseConflictError(); throw error; }

export async function listExpenseCategoriesThroughBackend(userId: string, token: string | undefined, organizationId: string) {
  const result = await backendRequest(`/api/v1/organizations/${organizationId}/expenses/categories`, token);
  if (!result.enabled) return listExpenseCategoriesForUser(userId, organizationId);
  return z.array(z.object({ id: z.uuid(), name: z.string(), color: z.string() }).passthrough()).parse(result.data).map(category => categorySchema.parse(category));
}
export async function getExpenseThroughBackend(userId: string, token: string | undefined, organizationId: string, expenseId: string) {
  try { const result = await backendRequest(`/api/v1/organizations/${organizationId}/expenses/${expenseId}`, token); return result.enabled ? detailSchema.parse(result.data) : getExpenseForUser(userId, organizationId, expenseId); }
  catch (error) { if (error instanceof BackendApiError && error.status === 404) return null; throw error; }
}
export async function listExpensesThroughBackend(userId: string, token: string | undefined, organizationId: string, query: ExpenseListQuery) {
  const search = new URLSearchParams({ page: String(query.page), page_size: String(query.pageSize), q: query.q, sort: query.sort });
  if (query.categoryId !== "all") search.set("category_id", query.categoryId); if (query.status !== "all") search.set("status", query.status); if (query.paymentMethod !== "all") search.set("payment_method", query.paymentMethod);
  const result = await backendRequest(`/api/v1/organizations/${organizationId}/expenses?${search}`, token);
  return result.enabled ? listSchema.parse(result.data) : listExpensesForUser(userId, organizationId, query);
}
export async function getExpenseReportsThroughBackend(userId: string, token: string | undefined, organizationId: string, range: AnalyticsRange) {
  const search = new URLSearchParams({ start: range.start, end_exclusive: range.endExclusive });
  const result = await backendRequest(`/api/v1/organizations/${organizationId}/expenses/metrics?${search}`, token);
  return result.enabled ? reportsSchema.parse(result.data) : getExpenseReportsForUser(userId, organizationId, range);
}
export async function createExpenseThroughBackend(userId: string, token: string | undefined, input: CreateInput) { try { const result = await mutate(`/api/v1/organizations/${input.organizationId}/expenses`, token, "POST", expenseBody(input)); return result.enabled ? z.object({ id: z.uuid() }).parse(result.data) : createExpenseForUser(userId, input); } catch (error) { return translate(error); } }
export async function updateExpenseThroughBackend(userId: string, token: string | undefined, input: UpdateInput) { try { const result = await mutate(`/api/v1/organizations/${input.organizationId}/expenses/${input.expenseId}`, token, "PATCH", { ...expenseBody(input), version: input.version }); return result.enabled ? { id: input.expenseId } : updateExpenseForUser(userId, input); } catch (error) { return translate(error); } }
export async function changeExpenseStatusThroughBackend(userId: string, token: string | undefined, input: StatusInput) { try { const result = await mutate(`/api/v1/organizations/${input.organizationId}/expenses/${input.expenseId}/transition`, token, "POST", { status: input.status, paid_date: input.paidDate, version: input.version }); return result.enabled ? { id: input.expenseId } : changeExpenseStatusForUser(userId, input); } catch (error) { return translate(error); } }
export async function deleteExpenseThroughBackend(userId: string, token: string | undefined, input: Identity) { try { const result = await mutate(`/api/v1/organizations/${input.organizationId}/expenses/${input.expenseId}`, token, "DELETE", { version: input.version }); return result.enabled ? { id: input.expenseId, receiptPath: null } : deleteExpenseForUser(userId, input); } catch (error) { return translate(error); } }
export async function uploadExpenseReceiptThroughBackend(token: string | undefined, input: Identity, file: File) { return backendRequest(`/api/v1/organizations/${input.organizationId}/expenses/${input.expenseId}/receipt`, token, { method: "PUT", body: await file.arrayBuffer(), headers: { "Content-Type": file.type, "X-Receipt-Name": file.name, "X-Expense-Version": String(input.version) } }); }
export async function removeExpenseReceiptThroughBackend(userId: string, token: string | undefined, input: Identity) { try { const result = await mutate(`/api/v1/organizations/${input.organizationId}/expenses/${input.expenseId}/receipt`, token, "DELETE", { version: input.version }); return result.enabled ? { id: input.expenseId, receiptPath: null } : detachExpenseReceiptForUser(userId, input); } catch (error) { return translate(error); } }
export async function getSignedExpenseReceiptThroughBackend(token: string | undefined, organizationId: string, expenseId: string) { const result = await backendRequest(`/api/v1/organizations/${organizationId}/expenses/${expenseId}/receipt`, token); return result.enabled ? z.object({ signed_url: z.url() }).parse(result.data).signed_url : null; }
export { attachExpenseReceiptForUser };
