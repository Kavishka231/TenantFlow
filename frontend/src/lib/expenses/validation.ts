import { z } from "zod";

import { parseExpenseAmount } from "./money";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date.");
const optionalDateSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  isoDateSchema.nullable(),
);
const optionalDescriptionSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().max(5000).nullable(),
);

export const expenseStatusSchema = z.enum(["pending", "paid", "reimbursed", "cancelled"]);
export const expensePaymentMethodSchema = z.enum(["cash", "bank_transfer", "card", "check", "other"]);

const amountSchema = z.unknown().transform((value, context) => {
  const amountMinor = parseExpenseAmount(value);
  if (amountMinor === null) {
    context.addIssue({ code: "custom", message: "Enter an amount between 0.01 and 10,000,000,000.00 with at most two decimals." });
    return z.NEVER;
  }
  return amountMinor;
});

export const expenseFieldsSchema = z.object({
  amountMinor: amountSchema,
  categoryId: z.uuid(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a three-letter currency code."),
  description: optionalDescriptionSchema,
  expenseDate: isoDateSchema,
  paidDate: optionalDateSchema,
  paymentMethod: expensePaymentMethodSchema,
  status: expenseStatusSchema,
  vendor: z.string().trim().min(1, "Enter a vendor.").max(160),
}).superRefine((value, context) => {
  const requiresPaymentDate = value.status === "paid" || value.status === "reimbursed";
  if (requiresPaymentDate !== Boolean(value.paidDate)) {
    context.addIssue({ code: "custom", path: ["paidDate"], message: requiresPaymentDate ? "Choose the payment date." : "Pending and cancelled expenses cannot have a payment date." });
  }
});

export const createExpenseSchema = expenseFieldsSchema.and(z.object({ organizationId: z.uuid() }));
export const updateExpenseSchema = expenseFieldsSchema.and(z.object({
  expenseId: z.uuid(),
  organizationId: z.uuid(),
  version: z.coerce.number().int().positive(),
}));
export const expenseIdentitySchema = z.object({ expenseId: z.uuid(), organizationId: z.uuid() });
export const deleteExpenseSchema = expenseIdentitySchema.extend({ version: z.coerce.number().int().positive() });
export const changeExpenseStatusSchema = expenseIdentitySchema.extend({
  paidDate: optionalDateSchema,
  status: expenseStatusSchema,
  version: z.coerce.number().int().positive(),
}).superRefine((value, context) => {
  const requiresPaymentDate = value.status === "paid" || value.status === "reimbursed";
  if (requiresPaymentDate !== Boolean(value.paidDate)) context.addIssue({ code: "custom", path: ["paidDate"], message: "Payment date does not match the selected status." });
});

export type ExpenseFields = z.infer<typeof expenseFieldsSchema>;
