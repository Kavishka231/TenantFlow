import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";

import { withUserContext } from "@/db/client";
import { customers, dealActivities, deals, organizationMembers, pipelineStages, profiles } from "@/db/schema";

export function getDealFormOptions(userId: string, organizationId: string) {
  return withUserContext(userId, async transaction => {
    const [customerRows, stages, members] = await Promise.all([
      transaction.select({ id: customers.id, name: customers.name, company: customers.company }).from(customers).where(eq(customers.organizationId, organizationId)).orderBy(asc(customers.name)),
      transaction.select().from(pipelineStages).where(eq(pipelineStages.organizationId, organizationId)).orderBy(asc(pipelineStages.position)),
      transaction.select({ userId: organizationMembers.userId, fullName: profiles.fullName, role: organizationMembers.role }).from(organizationMembers).innerJoin(profiles, eq(profiles.id, organizationMembers.userId)).where(eq(organizationMembers.organizationId, organizationId)).orderBy(asc(profiles.fullName)),
    ]);
    return { customers: customerRows, stages, members };
  });
}

export function listPipelineForUser(userId: string, organizationId: string) {
  return withUserContext(userId, async transaction => {
    const [stages, rows] = await Promise.all([
      transaction.select().from(pipelineStages).where(eq(pipelineStages.organizationId, organizationId)).orderBy(asc(pipelineStages.position)),
      transaction.select({ id: deals.id, title: deals.title, stageId: deals.stageId, customerName: customers.name, assigneeName: profiles.fullName, valueMinor: deals.valueMinor, currency: deals.currency, expectedCloseDate: deals.expectedCloseDate, outcome: deals.outcome, version: deals.version })
        .from(deals).innerJoin(customers, and(eq(customers.id, deals.customerId), eq(customers.organizationId, deals.organizationId)))
        .leftJoin(profiles, eq(profiles.id, deals.assignedUserId))
        .where(eq(deals.organizationId, organizationId)).orderBy(asc(deals.expectedCloseDate), asc(deals.title)),
    ]);
    return { stages, deals: rows };
  });
}

export function getDealForUser(userId: string, organizationId: string, dealId: string) {
  return withUserContext(userId, async transaction => {
    const [deal] = await transaction.select({
      id: deals.id, organizationId: deals.organizationId, title: deals.title, description: deals.description,
      customerId: deals.customerId, customerName: customers.name, stageId: deals.stageId, stageName: pipelineStages.name,
      stageKind: pipelineStages.kind, stageColor: pipelineStages.color, assignedUserId: deals.assignedUserId,
      assigneeName: profiles.fullName, valueMinor: deals.valueMinor, currency: deals.currency,
      expectedCloseDate: deals.expectedCloseDate, outcome: deals.outcome, outcomeReason: deals.outcomeReason,
      closedAt: deals.closedAt, version: deals.version, createdAt: deals.createdAt, updatedAt: deals.updatedAt,
    }).from(deals).innerJoin(customers, and(eq(customers.id, deals.customerId), eq(customers.organizationId, deals.organizationId)))
      .innerJoin(pipelineStages, and(eq(pipelineStages.id, deals.stageId), eq(pipelineStages.organizationId, deals.organizationId)))
      .leftJoin(profiles, eq(profiles.id, deals.assignedUserId))
      .where(and(eq(deals.organizationId, organizationId), eq(deals.id, dealId))).limit(1);
    if (!deal) return null;
    const activities = await transaction.select({ id: dealActivities.id, type: dealActivities.type, note: dealActivities.note, metadata: dealActivities.metadata, createdAt: dealActivities.createdAt, actorName: profiles.fullName })
      .from(dealActivities).leftJoin(profiles, eq(profiles.id, dealActivities.actorId))
      .where(and(eq(dealActivities.organizationId, organizationId), eq(dealActivities.dealId, dealId))).orderBy(desc(dealActivities.createdAt));
    return { ...deal, activities };
  });
}
