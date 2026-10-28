import "server-only";

import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import { withUserContext } from "@/db/client";
import { dealActivities, deals } from "@/db/schema";
import type { addDealNoteSchema, createDealSchema, deleteDealSchema, transitionDealSchema, updateDealSchema } from "@/lib/deals/validation";

export class DealConflictError extends Error {
  constructor(message = "This deal changed since the page was loaded. Refresh and try again.") { super(message); this.name = "DealConflictError"; }
}

export function createDealForUser(userId: string, input: z.infer<typeof createDealSchema>) {
  return withUserContext(userId, async transaction => {
    const [deal] = await transaction.insert(deals).values({
      organizationId: input.organizationId, customerId: input.customerId, stageId: input.stageId,
      assignedUserId: input.assignedUserId, title: input.title, description: input.description,
      valueMinor: input.valueMinor, currency: input.currency, expectedCloseDate: input.expectedCloseDate,
      createdBy: userId, updatedBy: userId,
    }).returning({ id: deals.id });
    if (!deal) throw new Error("The deal could not be created.");
    return deal;
  });
}

export function updateDealForUser(userId: string, input: z.infer<typeof updateDealSchema>) {
  return withUserContext(userId, async transaction => {
    const [deal] = await transaction.update(deals).set({
      customerId: input.customerId, stageId: input.stageId, assignedUserId: input.assignedUserId,
      title: input.title, description: input.description, valueMinor: input.valueMinor,
      currency: input.currency, expectedCloseDate: input.expectedCloseDate, updatedBy: userId,
    }).where(and(eq(deals.id, input.dealId), eq(deals.organizationId, input.organizationId), eq(deals.version, input.version))).returning({ id: deals.id });
    if (!deal) throw new DealConflictError();
    return deal;
  });
}

export function transitionDealForUser(userId: string, input: z.infer<typeof transitionDealSchema>) {
  return withUserContext(userId, async transaction => {
    const [deal] = await transaction.update(deals).set({ stageId: input.stageId, outcomeReason: input.outcomeReason, updatedBy: userId })
      .where(and(eq(deals.id, input.dealId), eq(deals.organizationId, input.organizationId), eq(deals.version, input.version)))
      .returning({ id: deals.id });
    if (!deal) throw new DealConflictError();
    return deal;
  });
}

export function deleteDealForUser(userId: string, input: z.infer<typeof deleteDealSchema>) {
  return withUserContext(userId, async transaction => {
    const [deal] = await transaction.delete(deals).where(and(eq(deals.id, input.dealId), eq(deals.organizationId, input.organizationId), eq(deals.version, input.version))).returning({ id: deals.id });
    if (!deal) throw new DealConflictError();
    return deal;
  });
}

export function addDealNoteForUser(userId: string, input: z.infer<typeof addDealNoteSchema>) {
  return withUserContext(userId, async transaction => {
    const [activity] = await transaction.insert(dealActivities).values({ organizationId: input.organizationId, dealId: input.dealId, actorId: userId, type: "note_added", note: input.note }).returning({ id: dealActivities.id });
    if (!activity) throw new Error("The note could not be added.");
    return activity;
  });
}
