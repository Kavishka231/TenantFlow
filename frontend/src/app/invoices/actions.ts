"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { InvoiceActionState } from "@/lib/invoices/action-state";
import {
  createInvoiceForUser,
  deleteInvoiceForUser,
  InvoiceConflictError,
  updateInvoiceForUser,
} from "@/lib/invoices/mutations";
import {
  createInvoiceSchema,
  deleteInvoiceSchema,
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
  const unitPrices = formData.getAll("itemUnitPriceMinor");
  return {
    currency: formData.get("currency"),
    customerId: formData.get("customerId"),
    discountMinor: formData.get("discountMinor"),
    dueDate: formData.get("dueDate"),
    issueDate: formData.get("issueDate"),
    items: descriptions.map((description, index) => ({
      description,
      quantity: quantities[index],
      unitPriceMinor: unitPrices[index],
    })),
    notes: formData.get("notes"),
    taxRateBps: formData.get("taxRateBps"),
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
