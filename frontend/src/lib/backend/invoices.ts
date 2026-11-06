import "server-only";

import { z } from "zod";

import { PlanLimitError } from "@/lib/billing/entitlements";
import { BackendApiError, backendBinaryRequest, backendRequest } from "@/lib/backend/client";
import { getInvoiceForUser } from "@/lib/invoices/get";
import { listInvoiceCustomersForUser, listInvoicesForUser } from "@/lib/invoices/list";
import {
  cancelInvoiceForUser,
  createInvoiceForUser,
  deleteInvoiceForUser,
  InvoiceConflictError,
  recordInvoicePaymentForUser,
  sendInvoiceForUser,
  updateInvoiceForUser,
} from "@/lib/invoices/mutations";
import { buildInvoicePdf } from "@/lib/invoices/pdf";
import type { InvoiceListQuery } from "@/lib/invoices/query";
import type { createInvoiceSchema, deleteInvoiceSchema, invoiceLifecycleSchema, recordPaymentSchema, updateInvoiceSchema } from "@/lib/invoices/validation";

type CreateInput = z.infer<typeof createInvoiceSchema>;
type UpdateInput = z.infer<typeof updateInvoiceSchema>;
type DeleteInput = z.infer<typeof deleteInvoiceSchema>;
type LifecycleInput = z.infer<typeof invoiceLifecycleSchema>;
type PaymentInput = z.infer<typeof recordPaymentSchema>;

const statusSchema = z.enum(["draft", "sent", "partially_paid", "paid", "overdue", "cancelled"]);
const paymentMethodSchema = z.enum(["cash", "bank_transfer", "card", "check", "other"]);
const itemSchema = z.object({
  id: z.uuid(), organization_id: z.uuid(), invoice_id: z.uuid(), description: z.string(), quantity: z.number().int(),
  unit_price_minor: z.number().int(), line_total_minor: z.number().int(), position: z.number().int(), created_at: z.coerce.date(),
}).transform(({ organization_id, invoice_id, unit_price_minor, line_total_minor, created_at, ...item }) => ({
  ...item, organizationId: organization_id, invoiceId: invoice_id, unitPriceMinor: unit_price_minor, lineTotalMinor: line_total_minor, createdAt: created_at,
}));
const paymentSchema = z.object({
  id: z.uuid(), organization_id: z.uuid(), invoice_id: z.uuid(), idempotency_key: z.uuid(), amount_minor: z.number().int(),
  payment_date: z.string(), method: paymentMethodSchema, reference: z.string().nullable(), notes: z.string().nullable(), recorded_by: z.uuid(), created_at: z.coerce.date(),
}).transform(({ organization_id, invoice_id, idempotency_key, amount_minor, payment_date, recorded_by, created_at, ...payment }) => ({
  ...payment, organizationId: organization_id, invoiceId: invoice_id, idempotencyKey: idempotency_key, amountMinor: amount_minor,
  paymentDate: payment_date, recordedBy: recorded_by, createdAt: created_at,
}));
const invoiceBaseSchema = z.object({
  id: z.uuid(), organization_id: z.uuid(), customer_id: z.uuid(), invoice_number: z.string(), number_sequence: z.number().int(), status: statusSchema,
  currency: z.string(), issue_date: z.string(), due_date: z.string(), notes: z.string().nullable(), discount_minor: z.number().int(), tax_rate_bps: z.number().int(),
  subtotal_minor: z.number().int(), tax_minor: z.number().int(), total_minor: z.number().int(), paid_minor: z.number().int(), version: z.number().int(),
  sent_at: z.coerce.date().nullable(), cancelled_at: z.coerce.date().nullable(), created_at: z.coerce.date(), updated_at: z.coerce.date(),
});
const invoiceDetailSchema = invoiceBaseSchema.extend({
  customer_name: z.string(), customer_company: z.string().nullable(), customer_email: z.string().nullable(), items: z.array(itemSchema), payments: z.array(paymentSchema),
}).transform(({ organization_id, customer_id, invoice_number, number_sequence, issue_date, due_date, discount_minor, tax_rate_bps, subtotal_minor, tax_minor, total_minor, paid_minor, sent_at, cancelled_at, created_at, updated_at, customer_name, customer_company, customer_email, ...invoice }) => ({
  ...invoice, organizationId: organization_id, customerId: customer_id, invoiceNumber: invoice_number, numberSequence: number_sequence,
  issueDate: issue_date, dueDate: due_date, discountMinor: discount_minor, taxRateBps: tax_rate_bps, subtotalMinor: subtotal_minor,
  taxMinor: tax_minor, totalMinor: total_minor, paidMinor: paid_minor, sentAt: sent_at, cancelledAt: cancelled_at, createdAt: created_at,
  updatedAt: updated_at, customerName: customer_name, customerCompany: customer_company, customerEmail: customer_email,
}));
const listSchema = z.object({
  invoices: z.array(z.object({
    id: z.uuid(), invoice_number: z.string(), customer_name: z.string(), status: statusSchema, currency: z.string(), issue_date: z.string(), due_date: z.string(), total_minor: z.number().int(), paid_minor: z.number().int(),
  }).transform(({ invoice_number, customer_name, issue_date, due_date, total_minor, paid_minor, ...invoice }) => ({
    ...invoice, invoiceNumber: invoice_number, customerName: customer_name, issueDate: issue_date, dueDate: due_date, totalMinor: total_minor, paidMinor: paid_minor,
  }))), page: z.number().int(), page_count: z.number().int(), page_size: z.number().int(), total: z.number().int(),
}).transform(({ invoices, page, page_count, page_size, total }) => ({
  invoices,
  page,
  pageCount: page_count,
  pageSize: page_size,
  total,
}));
const customerOptionsSchema = z.array(z.object({ id: z.uuid(), name: z.string(), company: z.string().nullable() }));

function invoiceBody(input: CreateInput | UpdateInput) {
  return {
    customer_id: input.customerId, currency: input.currency, issue_date: input.issueDate, due_date: input.dueDate, notes: input.notes,
    discount_minor: input.discountMinor, tax_rate_bps: input.taxRateBps,
    items: input.items.map((item) => ({ description: item.description, quantity: item.quantity, unit_price_minor: item.unitPriceMinor })),
  };
}

export async function listInvoicesThroughBackend(userId: string, token: string | undefined, organizationId: string, query: InvoiceListQuery) {
  const search = new URLSearchParams({ page: String(query.page), page_size: String(query.pageSize), q: query.q, sort: query.sort });
  if (query.status !== "all") search.set("status", query.status);
  const result = await backendRequest(`/api/v1/organizations/${organizationId}/invoices?${search}`, token);
  return result.enabled ? listSchema.parse(result.data) : listInvoicesForUser(userId, organizationId, query);
}

export async function getInvoiceThroughBackend(userId: string, token: string | undefined, organizationId: string, invoiceId: string) {
  try {
    const result = await backendRequest(`/api/v1/organizations/${organizationId}/invoices/${invoiceId}`, token);
    return result.enabled ? invoiceDetailSchema.parse(result.data) : getInvoiceForUser(userId, organizationId, invoiceId);
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) return null;
    throw error;
  }
}

export async function listInvoiceCustomersThroughBackend(userId: string, token: string | undefined, organizationId: string) {
  const result = await backendRequest(`/api/v1/organizations/${organizationId}/invoices/customer-options`, token);
  return result.enabled ? customerOptionsSchema.parse(result.data) : listInvoiceCustomersForUser(userId, organizationId);
}

async function mutation(path: string, token: string | undefined, method: string, body: unknown) {
  return backendRequest(path, token, { method, body: JSON.stringify(body) });
}

export async function createInvoiceThroughBackend(userId: string, token: string | undefined, input: CreateInput) {
  try {
    const result = await mutation(`/api/v1/organizations/${input.organizationId}/invoices`, token, "POST", invoiceBody(input));
    if (!result.enabled) return createInvoiceForUser(userId, input);
    return z.object({ id: z.uuid(), invoice_number: z.string() }).transform(({ invoice_number, ...value }) => ({ ...value, invoiceNumber: invoice_number })).parse(result.data);
  } catch (error) {
    if (error instanceof BackendApiError && error.code === "invoice_plan_limit") throw new PlanLimitError("invoices");
    if (error instanceof BackendApiError && error.code === "invoice_conflict") throw new InvoiceConflictError();
    throw error;
  }
}

export async function updateInvoiceThroughBackend(userId: string, token: string | undefined, input: UpdateInput) {
  try {
    const result = await mutation(`/api/v1/organizations/${input.organizationId}/invoices/${input.invoiceId}`, token, "PATCH", { ...invoiceBody(input), version: input.version });
    return result.enabled ? { id: input.invoiceId } : updateInvoiceForUser(userId, input);
  } catch (error) { if (error instanceof BackendApiError && error.code === "invoice_conflict") throw new InvoiceConflictError(); throw error; }
}

export async function deleteInvoiceThroughBackend(userId: string, token: string | undefined, input: DeleteInput) {
  try {
    const result = await mutation(`/api/v1/organizations/${input.organizationId}/invoices/${input.invoiceId}`, token, "DELETE", { version: input.version });
    return result.enabled ? { id: input.invoiceId } : deleteInvoiceForUser(userId, input);
  } catch (error) { if (error instanceof BackendApiError && error.code === "invoice_conflict") throw new InvoiceConflictError(); throw error; }
}

export async function sendInvoiceThroughBackend(userId: string, token: string | undefined, input: LifecycleInput) {
  const result = await mutation(`/api/v1/organizations/${input.organizationId}/invoices/${input.invoiceId}/send`, token, "POST", { version: input.version });
  return result.enabled ? undefined : sendInvoiceForUser(userId, input);
}
export async function cancelInvoiceThroughBackend(userId: string, token: string | undefined, input: LifecycleInput) {
  const result = await mutation(`/api/v1/organizations/${input.organizationId}/invoices/${input.invoiceId}/cancel`, token, "POST", { version: input.version });
  return result.enabled ? undefined : cancelInvoiceForUser(userId, input);
}
export async function recordInvoicePaymentThroughBackend(userId: string, token: string | undefined, input: PaymentInput) {
  const result = await mutation(`/api/v1/organizations/${input.organizationId}/invoices/${input.invoiceId}/payments`, token, "POST", {
    idempotency_key: input.idempotencyKey, amount_minor: input.amountMinor, payment_date: input.paymentDate, method: input.method, reference: input.reference, notes: input.notes,
  });
  return result.enabled ? undefined : recordInvoicePaymentForUser(userId, input);
}
export async function getInvoicePdfThroughBackend(userId: string, token: string | undefined, organizationId: string, invoiceId: string, organizationName: string) {
  const result = await backendBinaryRequest(`/api/v1/organizations/${organizationId}/invoices/${invoiceId}/pdf`, token);
  if (result.enabled) return {
    contentDisposition: result.headers.get("content-disposition") ?? "attachment; filename=invoice.pdf",
    pdf: Buffer.from(result.data),
  };
  const invoice = await getInvoiceForUser(userId, organizationId, invoiceId);
  return invoice ? {
    contentDisposition: `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    pdf: buildInvoicePdf(invoice, organizationName),
  } : null;
}
