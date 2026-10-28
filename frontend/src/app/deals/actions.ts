"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { DealActionState } from "@/lib/deals/action-state";
import { addDealNoteForUser, createDealForUser, DealConflictError, deleteDealForUser, transitionDealForUser, updateDealForUser } from "@/lib/deals/mutations";
import { addDealNoteSchema, createDealSchema, deleteDealSchema, transitionDealSchema, updateDealSchema } from "@/lib/deals/validation";
import { decimalToMinorUnits } from "@/lib/invoices/money";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";

async function requireUser() { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login"); return user; }
function fields(formData: FormData) { return { title: formData.get("title"), description: formData.get("description"), customerId: formData.get("customerId"), stageId: formData.get("stageId"), assignedUserId: formData.get("assignedUserId"), valueMinor: decimalToMinorUnits(formData.get("value")), currency: formData.get("currency"), expectedCloseDate: formData.get("expectedCloseDate") }; }
function errorState(error: unknown): DealActionState { return { status: "error", message: error instanceof DealConflictError ? error.message : "The deal could not be saved. Check that the customer, stage, and assignee belong to this workspace." }; }

export async function createDealAction(_state: DealActionState, formData: FormData): Promise<DealActionState> {
  const result = createDealSchema.safeParse({ ...fields(formData), organizationId: formData.get("organizationId") }); if (!result.success) return { status: "error", message: result.error.issues[0]?.message ?? "Check the deal details." };
  const user = await requireUser(); let dealId: string; try { await requireOrganizationPermission(user.id, result.data.organizationId, "manage_deals"); const deal = await createDealForUser(user.id, result.data); dealId = deal.id; revalidatePath(`/organizations/${result.data.organizationId}/pipeline`); } catch (error) { return errorState(error); } redirect(`/organizations/${result.data.organizationId}/deals/${dealId}?created=1`);
}
export async function updateDealAction(_state: DealActionState, formData: FormData): Promise<DealActionState> {
  const result = updateDealSchema.safeParse({ ...fields(formData), organizationId: formData.get("organizationId"), dealId: formData.get("dealId"), version: formData.get("version") }); if (!result.success) return { status: "error", message: result.error.issues[0]?.message ?? "Check the deal details." };
  const user = await requireUser(); try { await requireOrganizationPermission(user.id, result.data.organizationId, "manage_deals"); await updateDealForUser(user.id, result.data); revalidatePath(`/organizations/${result.data.organizationId}/pipeline`); } catch (error) { return errorState(error); } redirect(`/organizations/${result.data.organizationId}/deals/${result.data.dealId}?updated=1`);
}
export async function transitionDealAction(formData: FormData) { const result = transitionDealSchema.safeParse({ organizationId: formData.get("organizationId"), dealId: formData.get("dealId"), stageId: formData.get("stageId"), version: formData.get("version"), outcomeReason: formData.get("outcomeReason") }); if (!result.success) redirect("/dashboard"); const user = await requireUser(); await requireOrganizationPermission(user.id, result.data.organizationId, "manage_deals"); await transitionDealForUser(user.id, result.data); revalidatePath(`/organizations/${result.data.organizationId}/pipeline`); revalidatePath(`/organizations/${result.data.organizationId}/deals/${result.data.dealId}`); }
export async function deleteDealAction(formData: FormData) { const result = deleteDealSchema.safeParse({ organizationId: formData.get("organizationId"), dealId: formData.get("dealId"), version: formData.get("version") }); if (!result.success) redirect("/dashboard"); const user = await requireUser(); await requireOrganizationPermission(user.id, result.data.organizationId, "manage_deals"); await deleteDealForUser(user.id, result.data); revalidatePath(`/organizations/${result.data.organizationId}/pipeline`); redirect(`/organizations/${result.data.organizationId}/pipeline?deleted=1`); }
export async function addDealNoteAction(formData: FormData) { const result = addDealNoteSchema.safeParse({ organizationId: formData.get("organizationId"), dealId: formData.get("dealId"), note: formData.get("note") }); if (!result.success) redirect("/dashboard"); const user = await requireUser(); await requireOrganizationPermission(user.id, result.data.organizationId, "manage_deals"); await addDealNoteForUser(user.id, result.data); revalidatePath(`/organizations/${result.data.organizationId}/deals/${result.data.dealId}`); }
