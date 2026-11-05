"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { DealActionState } from "@/lib/deals/action-state";
import { addDealNoteThroughBackend, createDealThroughBackend, deleteDealThroughBackend, transitionDealThroughBackend, updateDealThroughBackend } from "@/lib/backend/deals";
import { backendActionErrorMessage } from "@/lib/backend/errors";
import { DealConflictError } from "@/lib/deals/mutations";
import { addDealNoteSchema, createDealSchema, deleteDealSchema, transitionDealSchema, updateDealSchema } from "@/lib/deals/validation";
import { decimalToMinorUnits } from "@/lib/invoices/money";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";

async function requireUser() { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login"); const { data: { session } } = await supabase.auth.getSession(); return { accessToken: session?.access_token, user }; }
function fields(formData: FormData) { return { title: formData.get("title"), description: formData.get("description"), customerId: formData.get("customerId"), stageId: formData.get("stageId"), assignedUserId: formData.get("assignedUserId"), valueMinor: decimalToMinorUnits(formData.get("value")), currency: formData.get("currency"), expectedCloseDate: formData.get("expectedCloseDate") }; }
function errorState(error: unknown): DealActionState {
  const fallback = "The deal could not be saved. Check that the customer, stage, and assignee belong to this workspace.";
  return {
    status: "error",
    message: error instanceof DealConflictError
      ? error.message
      : backendActionErrorMessage(error, fallback),
  };
}

export async function createDealAction(_state: DealActionState, formData: FormData): Promise<DealActionState> {
  const result = createDealSchema.safeParse({ ...fields(formData), organizationId: formData.get("organizationId") }); if (!result.success) return { status: "error", message: result.error.issues[0]?.message ?? "Check the deal details." };
  const { accessToken, user } = await requireUser(); let dealId: string; try { await requireOrganizationPermission(user.id, result.data.organizationId, "manage_deals"); const deal = await createDealThroughBackend(user.id, accessToken, result.data); dealId = deal.id; revalidatePath(`/organizations/${result.data.organizationId}/pipeline`); } catch (error) { return errorState(error); } redirect(`/organizations/${result.data.organizationId}/deals/${dealId}?created=1`);
}
export async function updateDealAction(_state: DealActionState, formData: FormData): Promise<DealActionState> {
  const result = updateDealSchema.safeParse({ ...fields(formData), organizationId: formData.get("organizationId"), dealId: formData.get("dealId"), version: formData.get("version") }); if (!result.success) return { status: "error", message: result.error.issues[0]?.message ?? "Check the deal details." };
  const { accessToken, user } = await requireUser(); try { await requireOrganizationPermission(user.id, result.data.organizationId, "manage_deals"); await updateDealThroughBackend(user.id, accessToken, result.data); revalidatePath(`/organizations/${result.data.organizationId}/pipeline`); } catch (error) { return errorState(error); } redirect(`/organizations/${result.data.organizationId}/deals/${result.data.dealId}?updated=1`);
}
export async function transitionDealAction(formData: FormData) { const result = transitionDealSchema.safeParse({ organizationId: formData.get("organizationId"), dealId: formData.get("dealId"), stageId: formData.get("stageId"), version: formData.get("version"), outcomeReason: formData.get("outcomeReason") }); if (!result.success) redirect("/dashboard"); const { accessToken, user } = await requireUser(); await requireOrganizationPermission(user.id, result.data.organizationId, "manage_deals"); await transitionDealThroughBackend(user.id, accessToken, result.data); revalidatePath(`/organizations/${result.data.organizationId}/pipeline`); revalidatePath(`/organizations/${result.data.organizationId}/deals/${result.data.dealId}`); }
export async function deleteDealAction(formData: FormData) { const result = deleteDealSchema.safeParse({ organizationId: formData.get("organizationId"), dealId: formData.get("dealId"), version: formData.get("version") }); if (!result.success) redirect("/dashboard"); const { accessToken, user } = await requireUser(); await requireOrganizationPermission(user.id, result.data.organizationId, "manage_deals"); await deleteDealThroughBackend(user.id, accessToken, result.data); revalidatePath(`/organizations/${result.data.organizationId}/pipeline`); redirect(`/organizations/${result.data.organizationId}/pipeline?deleted=1`); }
export async function addDealNoteAction(formData: FormData) { const result = addDealNoteSchema.safeParse({ organizationId: formData.get("organizationId"), dealId: formData.get("dealId"), note: formData.get("note") }); if (!result.success) redirect("/dashboard"); const { accessToken, user } = await requireUser(); await requireOrganizationPermission(user.id, result.data.organizationId, "manage_deals"); await addDealNoteThroughBackend(user.id, accessToken, result.data); revalidatePath(`/organizations/${result.data.organizationId}/deals/${result.data.dealId}`); }
