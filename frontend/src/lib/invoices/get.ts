import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { withUserContext } from "@/db/client";
import { customers, invoiceItems, invoices, paymentRecords } from "@/db/schema";
import { invoiceIdentitySchema } from "@/lib/invoices/validation";

export async function getInvoiceForUser(userId: string, organizationId: string, invoiceId: string) {
  const identity = invoiceIdentitySchema.safeParse({ invoiceId, organizationId });
  if (!identity.success) return null;

  return withUserContext(userId, async (transaction) => {
    const [invoice] = await transaction
      .select({
        cancelledAt: invoices.cancelledAt,
        createdAt: invoices.createdAt,
        currency: invoices.currency,
        customerCompany: customers.company,
        customerEmail: customers.email,
        customerId: customers.id,
        customerName: customers.name,
        discountMinor: invoices.discountMinor,
        dueDate: invoices.dueDate,
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        issueDate: invoices.issueDate,
        notes: invoices.notes,
        paidMinor: invoices.paidMinor,
        sentAt: invoices.sentAt,
        status: invoices.status,
        subtotalMinor: invoices.subtotalMinor,
        taxMinor: invoices.taxMinor,
        taxRateBps: invoices.taxRateBps,
        totalMinor: invoices.totalMinor,
        updatedAt: invoices.updatedAt,
        version: invoices.version,
      })
      .from(invoices)
      .innerJoin(customers, and(eq(customers.id, invoices.customerId), eq(customers.organizationId, invoices.organizationId)))
      .where(and(eq(invoices.id, identity.data.invoiceId), eq(invoices.organizationId, identity.data.organizationId)))
      .limit(1);

    if (!invoice) return null;
    const [items, payments] = await Promise.all([
      transaction.select().from(invoiceItems).where(and(eq(invoiceItems.invoiceId, invoice.id), eq(invoiceItems.organizationId, organizationId))).orderBy(asc(invoiceItems.position)),
      transaction.select().from(paymentRecords).where(and(eq(paymentRecords.invoiceId, invoice.id), eq(paymentRecords.organizationId, organizationId))).orderBy(asc(paymentRecords.paymentDate), asc(paymentRecords.createdAt)),
    ]);
    return { ...invoice, items, payments };
  });
}

export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof getInvoiceForUser>>>;
