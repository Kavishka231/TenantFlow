"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { InvoiceActionState } from "@/lib/invoices/action-state";
import { PlanLimitError } from "@/lib/billing/entitlements";
import { decimalToMinorUnits, percentageToBasisPoints } from "@/lib/invoices/money";
import {
  createInvoiceForUser,
  cancelInvoiceForUser,
  deleteInvoiceForUser,
  InvoiceConflictError,
  recordInvoicePaymentForUser,
  sendInvoiceForUser,
  updateInvoiceForUser,
} from "@/lib/invoices/mutations";
import {
  createInvoiceSchema,
  deleteInvoiceSchema,
  invoiceLifecycleSchema,
  recordPaymentSchema,
  updateInvoiceSchema,
} from "@/lib/invoices/validation";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

function invoiceFormValues(formData: FormData) {
  const descriptions = formData.getAll("itemDescription");
  const quantities = formData.getAll("itemQuantity");
  const unitPrices = formData.getAll("itemUnitPrice");
  return {
    currency: formData.get("currency"),
    customerId: formData.get("customerId"),
    discountMinor: decimalToMinorUnits(formData.get("discount")),
    dueDate: formData.get("dueDate"),
    issueDate: formData.get("issueDate"),
    items: descriptions.map((description, index) => ({
      description,
      quantity: quantities[index],
      unitPriceMinor: decimalToMinorUnits(unitPrices[index] ?? null),
    })),
    notes: formData.get("notes"),
    taxRateBps: percentageToBasisPoints(formData.get("taxRate")),
  };
}

export async function createInvoiceAction(_state: InvoiceActionState, formData: FormData): Promise<InvoiceActionState> {
  const result = createInvoiceSchema.safeParse({ ...invoiceFormValues(formData), organizationId: formData.get("organizationId") });
  if (!result.success) return { message: result.error.issues[0]?.message ?? "Check the invoice details.", status: "error" };
  const user = await requireUser();
  try {
    await requireOrganizationPermission(user.id, result.data.organizationId, "manage_invoices");
    const invoice = await createInvoiceForUser(user.id, result.data);
    revalidatePath(`/organizations/${result.data.organizationId}/invoices`);
    redirect(`/organizations/${result.data.organizationId}/invoices/${invoice.id}?created=1`);
  } catch (error) {
    if (error instanceof PlanLimitError) return { message: `${error.message} Ask the workspace owner to upgrade billing.`, status: "error" };
    if (error instanceof InvoiceConflictError) return { message: error.message, status: "error" };
    throw error;
  }
}

export async function updateInvoiceAction(_state: InvoiceActionState, formData: FormData): Promise<InvoiceActionState> {
  const result = updateInvoiceSchema.safeParse({ ...invoiceFormValues(formData), invoiceId: formData.get("invoiceId"), organizationId: formData.get("organizationId"), version: formData.get("version") });
  if (!result.success) return { message: result.error.issues[0]?.message ?? "Check the invoice details.", status: "error" };
  const user = await requireUser();
  try {
    await requireOrganizationPermission(user.id, result.data.organizationId, "manage_invoices");
    await updateInvoiceForUser(user.id, result.data);
    revalidatePath(`/organizations/${result.data.organizationId}/invoices`);
    revalidatePath(`/organizations/${result.data.organizationId}/invoices/${result.data.invoiceId}`);
    redirect(`/organizations/${result.data.organizationId}/invoices/${result.data.invoiceId}?updated=1`);
  } catch (error) {
    if (error instanceof InvoiceConflictError) return { message: error.message, status: "error" };
    throw error;
  }
}

export async function deleteInvoiceAction(formData: FormData) {
  const result = deleteInvoiceSchema.safeParse({ invoiceId: formData.get("invoiceId"), organizationId: formData.get("organizationId"), version: formData.get("version") });
  if (!result.success) redirect("/dashboard");
  const user = await requireUser();
  await requireOrganizationPermission(user.id, result.data.organizationId, "manage_invoices");
  await deleteInvoiceForUser(user.id, result.data);
  revalidatePath(`/organizations/${result.data.organizationId}/invoices`);
  redirect(`/organizations/${result.data.organizationId}/invoices?invoiceStatus=deleted`);
}

export async function sendInvoiceAction(formData: FormData) {
  const result = invoiceLifecycleSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    organizationId: formData.get("organizationId"),
    version: formData.get("version"),
  });
  if (!result.success) redirect("/dashboard");
  const user = await requireUser();
  await requireOrganizationPermission(user.id, result.data.organizationId, "manage_invoices");
  await sendInvoiceForUser(user.id, result.data);
  revalidatePath(`/organizations/${result.data.organizationId}/invoices`);
  revalidatePath(`/organizations/${result.data.organizationId}/invoices/${result.data.invoiceId}`);
  redirect(`/organizations/${result.data.organizationId}/invoices/${result.data.invoiceId}?sent=1`);
}

export async function cancelInvoiceAction(formData: FormData) {
  const result = invoiceLifecycleSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    organizationId: formData.get("organizationId"),
    version: formData.get("version"),
  });
  if (!result.success) redirect("/dashboard");
  const user = await requireUser();
  await requireOrganizationPermission(user.id, result.data.organizationId, "manage_invoices");
  await cancelInvoiceForUser(user.id, result.data);
  revalidatePath(`/organizations/${result.data.organizationId}/invoices`);
  revalidatePath(`/organizations/${result.data.organizationId}/invoices/${result.data.invoiceId}`);
  redirect(`/organizations/${result.data.organizationId}/invoices/${result.data.invoiceId}?cancelled=1`);
}

export async function recordPaymentAction(
  _state: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const result = recordPaymentSchema.safeParse({
    amountMinor: decimalToMinorUnits(formData.get("amount")),
    idempotencyKey: formData.get("idempotencyKey"),
    invoiceId: formData.get("invoiceId"),
    method: formData.get("method"),
    notes: formData.get("notes"),
    organizationId: formData.get("organizationId"),
    paymentDate: formData.get("paymentDate"),
    reference: formData.get("reference"),
  });
  if (!result.success) {
    return { message: result.error.issues[0]?.message ?? "Check the payment details.", status: "error" };
  }
  const user = await requireUser();
  try {
    await requireOrganizationPermission(user.id, result.data.organizationId, "manage_invoices");
    await recordInvoicePaymentForUser(user.id, result.data);
    revalidatePath(`/organizations/${result.data.organizationId}/invoices`);
    revalidatePath(`/organizations/${result.data.organizationId}/invoices/${result.data.invoiceId}`);
  } catch {
    return { message: "The payment could not be recorded. Check the outstanding balance and try again.", status: "error" };
  }
  redirect(`/organizations/${result.data.organizationId}/invoices/${result.data.invoiceId}?payment=recorded`);
}
