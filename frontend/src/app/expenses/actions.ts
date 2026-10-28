"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ExpenseActionState } from "@/lib/expenses/action-state";
import { changeExpenseStatusForUser, createExpenseForUser, deleteExpenseForUser, ExpenseConflictError, updateExpenseForUser } from "@/lib/expenses/mutations";
import { changeExpenseStatusSchema, createExpenseSchema, deleteExpenseSchema, updateExpenseSchema } from "@/lib/expenses/validation";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

function fields(formData: FormData) {
  return {
    amountMinor: formData.get("amount"), categoryId: formData.get("categoryId"),
    currency: formData.get("currency"), description: formData.get("description"),
    expenseDate: formData.get("expenseDate"), paidDate: formData.get("paidDate"),
    paymentMethod: formData.get("paymentMethod"), status: formData.get("status"), vendor: formData.get("vendor"),
  };
}

function actionError(error: unknown, fallback: string): ExpenseActionState {
  return { message: error instanceof ExpenseConflictError ? error.message : fallback, status: "error" };
}

export async function createExpenseAction(_state: ExpenseActionState, formData: FormData): Promise<ExpenseActionState> {
  const result = createExpenseSchema.safeParse({ ...fields(formData), organizationId: formData.get("organizationId") });
  if (!result.success) return { message: result.error.issues[0]?.message ?? "Check the expense details.", status: "error" };
  const user = await requireUser();
  let expenseId: string;
  try {
    await requireOrganizationPermission(user.id, result.data.organizationId, "manage_expenses");
    expenseId = (await createExpenseForUser(user.id, result.data)).id;
    revalidatePath(`/organizations/${result.data.organizationId}/expenses`);
  } catch (error) { return actionError(error, "You cannot create an expense in this workspace."); }
  redirect(`/organizations/${result.data.organizationId}/expenses/${expenseId}?created=1`);
}

export async function updateExpenseAction(_state: ExpenseActionState, formData: FormData): Promise<ExpenseActionState> {
  const result = updateExpenseSchema.safeParse({ ...fields(formData), expenseId: formData.get("expenseId"), organizationId: formData.get("organizationId"), version: formData.get("version") });
  if (!result.success) return { message: result.error.issues[0]?.message ?? "Check the expense details.", status: "error" };
  const user = await requireUser();
  try {
    await requireOrganizationPermission(user.id, result.data.organizationId, "manage_expenses");
    await updateExpenseForUser(user.id, result.data);
    revalidatePath(`/organizations/${result.data.organizationId}/expenses`);
    revalidatePath(`/organizations/${result.data.organizationId}/expenses/${result.data.expenseId}`);
  } catch (error) { return actionError(error, "You cannot update this expense."); }
  redirect(`/organizations/${result.data.organizationId}/expenses/${result.data.expenseId}?updated=1`);
}

export async function changeExpenseStatusAction(_state: ExpenseActionState, formData: FormData): Promise<ExpenseActionState> {
  const result = changeExpenseStatusSchema.safeParse({ expenseId: formData.get("expenseId"), organizationId: formData.get("organizationId"), paidDate: formData.get("paidDate"), status: formData.get("status"), version: formData.get("version") });
  if (!result.success) return { message: result.error.issues[0]?.message ?? "Check the payment status.", status: "error" };
  const user = await requireUser();
  try {
    await requireOrganizationPermission(user.id, result.data.organizationId, "manage_expenses");
    await changeExpenseStatusForUser(user.id, result.data);
    revalidatePath(`/organizations/${result.data.organizationId}/expenses`);
    revalidatePath(`/organizations/${result.data.organizationId}/expenses/${result.data.expenseId}`);
  } catch (error) { return actionError(error, "You cannot change this expense status."); }
  redirect(`/organizations/${result.data.organizationId}/expenses/${result.data.expenseId}?updated=1`);
}

export async function deleteExpenseAction(formData: FormData) {
  const result = deleteExpenseSchema.safeParse({ expenseId: formData.get("expenseId"), organizationId: formData.get("organizationId"), version: formData.get("version") });
  if (!result.success) redirect("/dashboard");
  const user = await requireUser();
  await requireOrganizationPermission(user.id, result.data.organizationId, "manage_expenses");
  await deleteExpenseForUser(user.id, result.data);
  revalidatePath(`/organizations/${result.data.organizationId}/expenses`);
  redirect(`/organizations/${result.data.organizationId}/expenses?expenseStatus=deleted`);
}
