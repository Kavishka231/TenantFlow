import { z } from "zod";

import { calculateInvoiceTotals } from "./money";

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Use a valid date.");

export const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, "Each item needs a description.").max(500),
  quantity: z.coerce.number().int().min(1).max(1_000_000),
  unitPriceMinor: z.coerce.number().int().min(0).max(1_000_000_000),
});

export const invoiceFieldsSchema = z
  .object({
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a three-letter currency code."),
    customerId: z.uuid(),
    discountMinor: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    dueDate: isoDateSchema,
    issueDate: isoDateSchema,
    items: z.array(invoiceItemSchema).min(1, "Add at least one invoice item.").max(100),
    notes: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? null : value),
      z.string().trim().max(5000).nullable(),
    ),
    taxRateBps: z.coerce.number().int().min(0).max(10_000),
  })
  .superRefine((value, context) => {
    if (value.dueDate < value.issueDate) {
      context.addIssue({ code: "custom", message: "The due date cannot precede the issue date.", path: ["dueDate"] });
    }
    try {
      calculateInvoiceTotals(value.items, value.discountMinor, value.taxRateBps);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Check the invoice totals.",
        path: ["discountMinor"],
      });
    }
  });

export const createInvoiceSchema = invoiceFieldsSchema.safeExtend({
  organizationId: z.uuid(),
});

export const updateInvoiceSchema = invoiceFieldsSchema.safeExtend({
  invoiceId: z.uuid(),
  organizationId: z.uuid(),
  version: z.coerce.number().int().positive(),
});

export const invoiceIdentitySchema = z.object({
  invoiceId: z.uuid(),
  organizationId: z.uuid(),
});

export const deleteInvoiceSchema = invoiceIdentitySchema.extend({
  version: z.coerce.number().int().positive(),
});

export const invoiceLifecycleSchema = invoiceIdentitySchema.extend({
  version: z.coerce.number().int().positive(),
});

export const paymentMethodSchema = z.enum([
  "cash",
  "bank_transfer",
  "card",
  "check",
  "other",
]);

export const recordPaymentSchema = invoiceIdentitySchema
  .extend({
    amountMinor: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    idempotencyKey: z.uuid(),
    method: paymentMethodSchema,
    notes: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? null : value),
      z.string().trim().max(2000).nullable(),
    ),
    paymentDate: isoDateSchema,
    reference: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? null : value),
      z.string().trim().min(1).max(160).nullable(),
    ),
  })
  .refine((value) => value.paymentDate <= new Date().toISOString().slice(0, 10), {
    message: "The payment date cannot be in the future.",
    path: ["paymentDate"],
  });

export type InvoiceFields = z.infer<typeof invoiceFieldsSchema>;
