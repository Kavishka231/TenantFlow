import "server-only";

import { and, eq, max, sql } from "drizzle-orm";
import type { z } from "zod";

import { withUserContext } from "@/db/client";
import { customers, invoiceItems, invoices } from "@/db/schema";
import { assertResourceCapacity } from "@/lib/billing/entitlements";
import { calculateInvoiceTotals } from "@/lib/invoices/money";
import type {
  createInvoiceSchema,
  deleteInvoiceSchema,
  updateInvoiceSchema,
  invoiceLifecycleSchema,
  recordPaymentSchema,
} from "@/lib/invoices/validation";

type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
type DeleteInvoiceInput = z.infer<typeof deleteInvoiceSchema>;
type InvoiceLifecycleInput = z.infer<typeof invoiceLifecycleSchema>;
type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export class InvoiceConflictError extends Error {
  constructor(message = "This invoice changed since the page was loaded. Refresh and try again.") {
    super(message);
    this.name = "InvoiceConflictError";
  }
}

async function requireTenantCustomer(
  transaction: Parameters<Parameters<typeof withUserContext>[1]>[0],
  organizationId: string,
  customerId: string,
) {
  const [customer] = await transaction
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.organizationId, organizationId)))
    .limit(1);

  if (!customer) throw new InvoiceConflictError("Select a customer from this workspace.");
}

function itemRows(
  organizationId: string,
  invoiceId: string,
  items: CreateInvoiceInput["items"],
) {
  return items.map((item, index) => ({
    description: item.description,
    invoiceId,
    lineTotalMinor: item.quantity * item.unitPriceMinor,
    organizationId,
    position: index + 1,
    quantity: item.quantity,
    unitPriceMinor: item.unitPriceMinor,
  }));
}

export function createInvoiceForUser(userId: string, input: CreateInvoiceInput) {
  return withUserContext(userId, async (transaction) => {
    await requireTenantCustomer(transaction, input.organizationId, input.customerId);
    await assertResourceCapacity(transaction, input.organizationId, "invoices");
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.organizationId}, 6146))`);

    const [sequenceResult] = await transaction
      .select({ value: max(invoices.numberSequence) })
      .from(invoices)
      .where(eq(invoices.organizationId, input.organizationId));
    const numberSequence = (sequenceResult?.value ?? 0) + 1;
    const invoiceNumber = `INV-${String(numberSequence).padStart(6, "0")}`;
    const totals = calculateInvoiceTotals(input.items, input.discountMinor, input.taxRateBps);

    const [invoice] = await transaction
      .insert(invoices)
      .values({
        ...totals,
        createdBy: userId,
        currency: input.currency,
        customerId: input.customerId,
        discountMinor: input.discountMinor,
        dueDate: input.dueDate,
        invoiceNumber,
        issueDate: input.issueDate,
        notes: input.notes,
        numberSequence,
        organizationId: input.organizationId,
        taxRateBps: input.taxRateBps,
        updatedBy: userId,
      })
      .returning({ id: invoices.id, invoiceNumber: invoices.invoiceNumber });

    if (!invoice) throw new Error("The invoice could not be created.");
    await transaction.insert(invoiceItems).values(itemRows(input.organizationId, invoice.id, input.items));
    return invoice;
  });
}

export function updateInvoiceForUser(userId: string, input: UpdateInvoiceInput) {
  return withUserContext(userId, async (transaction) => {
    await requireTenantCustomer(transaction, input.organizationId, input.customerId);
    const totals = calculateInvoiceTotals(input.items, input.discountMinor, input.taxRateBps);
    const [invoice] = await transaction
      .update(invoices)
      .set({
        ...totals,
        currency: input.currency,
        customerId: input.customerId,
        discountMinor: input.discountMinor,
        dueDate: input.dueDate,
        issueDate: input.issueDate,
        notes: input.notes,
        taxRateBps: input.taxRateBps,
        updatedAt: new Date(),
        updatedBy: userId,
        version: input.version + 1,
      })
      .where(
        and(
          eq(invoices.id, input.invoiceId),
          eq(invoices.organizationId, input.organizationId),
          eq(invoices.status, "draft"),
          eq(invoices.version, input.version),
        ),
      )
      .returning({ id: invoices.id });

    if (!invoice) throw new InvoiceConflictError("Only the current draft invoice can be edited.");
    await transaction.delete(invoiceItems).where(
      and(eq(invoiceItems.invoiceId, input.invoiceId), eq(invoiceItems.organizationId, input.organizationId)),
    );
    await transaction.insert(invoiceItems).values(itemRows(input.organizationId, input.invoiceId, input.items));
    return invoice;
  });
}

export function deleteInvoiceForUser(userId: string, input: DeleteInvoiceInput) {
  return withUserContext(userId, async (transaction) => {
    const [invoice] = await transaction
      .delete(invoices)
      .where(
        and(
          eq(invoices.id, input.invoiceId),
          eq(invoices.organizationId, input.organizationId),
          eq(invoices.status, "draft"),
          eq(invoices.version, input.version),
        ),
      )
      .returning({ id: invoices.id });
    if (!invoice) throw new InvoiceConflictError("Only the current draft invoice can be deleted.");
    return invoice;
  });
}

export function sendInvoiceForUser(userId: string, input: InvoiceLifecycleInput) {
  return withUserContext(userId, async (transaction) => {
    await transaction.execute(sql`
      select (public.send_invoice(${input.organizationId}::uuid, ${input.invoiceId}::uuid)).id
    `);
  });
}

export function cancelInvoiceForUser(userId: string, input: InvoiceLifecycleInput) {
  return withUserContext(userId, async (transaction) => {
    await transaction.execute(sql`
      select (public.cancel_invoice(${input.organizationId}::uuid, ${input.invoiceId}::uuid)).id
    `);
  });
}

export function recordInvoicePaymentForUser(userId: string, input: RecordPaymentInput) {
  return withUserContext(userId, async (transaction) => {
    await transaction.execute(sql`
      select (public.record_invoice_payment(
        ${input.organizationId}::uuid,
        ${input.invoiceId}::uuid,
        ${input.idempotencyKey}::uuid,
        ${input.amountMinor}::bigint,
        ${input.paymentDate}::date,
        ${input.method}::public.payment_method,
        ${input.reference},
        ${input.notes}
      )).id
    `);
  });
}
