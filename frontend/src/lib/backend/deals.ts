import "server-only";

import { z } from "zod";

import { BackendApiError, backendRequest } from "@/lib/backend/client";
import { getDealForUser, getDealFormOptions, listPipelineForUser } from "@/lib/deals/data";
import { getSalesMetricsForUser } from "@/lib/deals/metrics";
import {
  addDealNoteForUser,
  createDealForUser,
  DealConflictError,
  deleteDealForUser,
  transitionDealForUser,
  updateDealForUser,
} from "@/lib/deals/mutations";
import type { AnalyticsRange } from "@/lib/analytics/range";
import type {
  addDealNoteSchema,
  createDealSchema,
  deleteDealSchema,
  transitionDealSchema,
  updateDealSchema,
} from "@/lib/deals/validation";

type CreateInput = z.infer<typeof createDealSchema>;
type UpdateInput = z.infer<typeof updateDealSchema>;
type DeleteInput = z.infer<typeof deleteDealSchema>;
type TransitionInput = z.infer<typeof transitionDealSchema>;
type NoteInput = z.infer<typeof addDealNoteSchema>;

const kindSchema = z.enum(["open", "won", "lost"]);
const activityTypeSchema = z.enum(["created", "updated", "stage_changed", "won", "lost", "note_added"]);
const stageSchema = z.object({
  id: z.uuid(), organization_id: z.uuid(), name: z.string(), color: z.string(), position: z.number().int(), kind: kindSchema,
  created_at: z.coerce.date(), updated_at: z.coerce.date(),
}).transform(({ organization_id, created_at, updated_at, ...stage }) => ({
  ...stage, organizationId: organization_id, createdAt: created_at, updatedAt: updated_at,
}));
const dealListItemSchema = z.object({
  id: z.uuid(), title: z.string(), stage_id: z.uuid(), customer_name: z.string(), assignee_name: z.string().nullable(),
  value_minor: z.number().int(), currency: z.string(), expected_close_date: z.string().nullable(), outcome: kindSchema, version: z.number().int(),
}).transform(({ stage_id, customer_name, assignee_name, value_minor, expected_close_date, ...deal }) => ({
  ...deal, stageId: stage_id, customerName: customer_name, assigneeName: assignee_name, valueMinor: value_minor, expectedCloseDate: expected_close_date,
}));
const pipelineSchema = z.object({ stages: z.array(stageSchema), deals: z.array(dealListItemSchema) });
const activitySchema = z.object({
  id: z.uuid(), type: activityTypeSchema, note: z.string().nullable(), metadata: z.record(z.string(), z.unknown()),
  created_at: z.coerce.date(), actor_name: z.string().nullable(),
}).transform(({ created_at, actor_name, ...activity }) => ({ ...activity, createdAt: created_at, actorName: actor_name }));
const dealDetailSchema = z.object({
  id: z.uuid(), organization_id: z.uuid(), customer_id: z.uuid(), stage_id: z.uuid(), assigned_user_id: z.uuid().nullable(), title: z.string(),
  description: z.string().nullable(), value_minor: z.number().int(), currency: z.string(), expected_close_date: z.string().nullable(), outcome: kindSchema,
  outcome_reason: z.string().nullable(), closed_at: z.coerce.date().nullable(), version: z.number().int(), created_at: z.coerce.date(), updated_at: z.coerce.date(),
  customer_name: z.string(), stage_name: z.string(), stage_kind: kindSchema, stage_color: z.string(), assignee_name: z.string().nullable(), activities: z.array(activitySchema),
}).transform(({ organization_id, customer_id, stage_id, assigned_user_id, value_minor, expected_close_date, outcome_reason, closed_at, created_at, updated_at, customer_name, stage_name, stage_kind, stage_color, assignee_name, ...deal }) => ({
  ...deal, organizationId: organization_id, customerId: customer_id, stageId: stage_id, assignedUserId: assigned_user_id,
  valueMinor: value_minor, expectedCloseDate: expected_close_date, outcomeReason: outcome_reason, closedAt: closed_at, createdAt: created_at,
  updatedAt: updated_at, customerName: customer_name, stageName: stage_name, stageKind: stage_kind, stageColor: stage_color, assigneeName: assignee_name,
}));
const optionsSchema = z.object({
  customers: z.array(z.object({ id: z.uuid(), name: z.string(), company: z.string().nullable() })),
  stages: z.array(stageSchema),
  members: z.array(z.object({ user_id: z.uuid(), full_name: z.string().nullable(), role: z.enum(["owner", "admin", "member"]) })
    .transform(({ user_id, full_name, ...member }) => ({ ...member, userId: user_id, fullName: full_name }))),
});
const aggregateSchema = z.object({ currency: z.string(), amount_minor: z.number().int(), count: z.number().int() })
  .transform(({ amount_minor, ...aggregate }) => ({ ...aggregate, amountMinor: amount_minor }));
const stageAggregateSchema = z.object({ stage_id: z.uuid(), stage_name: z.string(), color: z.string(), kind: kindSchema, count: z.number().int() })
  .transform(({ stage_id, stage_name, ...stage }) => ({ ...stage, stageId: stage_id, stageName: stage_name }));
const metricsSchema = z.object({
  pipeline_value: z.array(aggregateSchema), won_revenue: z.array(aggregateSchema), stages: z.array(stageAggregateSchema),
  won_deals: z.number().int(), lost_deals: z.number().int(), conversion_rate: z.number(),
}).transform(({ pipeline_value, won_revenue, won_deals, lost_deals, conversion_rate, ...metrics }) => ({
  ...metrics, pipelineValue: pipeline_value, wonRevenue: won_revenue, wonDeals: won_deals, lostDeals: lost_deals, conversionRate: conversion_rate,
}));

function dealBody(input: CreateInput | UpdateInput) {
  return {
    title: input.title, description: input.description, customer_id: input.customerId, stage_id: input.stageId,
    assigned_user_id: input.assignedUserId, value_minor: input.valueMinor, currency: input.currency, expected_close_date: input.expectedCloseDate,
  };
}
async function mutation(path: string, token: string | undefined, method: string, body: unknown) {
  return backendRequest(path, token, { method, body: JSON.stringify(body) });
}
function translateConflict(error: unknown): never {
  if (error instanceof BackendApiError && error.code === "deal_conflict") throw new DealConflictError();
  throw error;
}

export async function getPipelineThroughBackend(userId: string, token: string | undefined, organizationId: string) {
  const result = await backendRequest(`/api/v1/organizations/${organizationId}/deals/pipeline`, token);
  return result.enabled ? pipelineSchema.parse(result.data) : listPipelineForUser(userId, organizationId);
}
export async function getDealOptionsThroughBackend(userId: string, token: string | undefined, organizationId: string) {
  const result = await backendRequest(`/api/v1/organizations/${organizationId}/deals/options`, token);
  return result.enabled ? optionsSchema.parse(result.data) : getDealFormOptions(userId, organizationId);
}
export async function getDealThroughBackend(userId: string, token: string | undefined, organizationId: string, dealId: string) {
  try {
    const result = await backendRequest(`/api/v1/organizations/${organizationId}/deals/${dealId}`, token);
    return result.enabled ? dealDetailSchema.parse(result.data) : getDealForUser(userId, organizationId, dealId);
  } catch (error) { if (error instanceof BackendApiError && error.status === 404) return null; throw error; }
}
export async function createDealThroughBackend(userId: string, token: string | undefined, input: CreateInput) {
  try {
    const result = await mutation(`/api/v1/organizations/${input.organizationId}/deals`, token, "POST", dealBody(input));
    if (!result.enabled) return createDealForUser(userId, input);
    return z.object({ id: z.uuid() }).parse(result.data);
  } catch (error) { return translateConflict(error); }
}
export async function updateDealThroughBackend(userId: string, token: string | undefined, input: UpdateInput) {
  try {
    const result = await mutation(`/api/v1/organizations/${input.organizationId}/deals/${input.dealId}`, token, "PATCH", { ...dealBody(input), version: input.version });
    return result.enabled ? { id: input.dealId } : updateDealForUser(userId, input);
  } catch (error) { return translateConflict(error); }
}
export async function transitionDealThroughBackend(userId: string, token: string | undefined, input: TransitionInput) {
  try {
    const result = await mutation(`/api/v1/organizations/${input.organizationId}/deals/${input.dealId}/transition`, token, "POST", { stage_id: input.stageId, version: input.version, outcome_reason: input.outcomeReason });
    return result.enabled ? { id: input.dealId } : transitionDealForUser(userId, input);
  } catch (error) { return translateConflict(error); }
}
export async function deleteDealThroughBackend(userId: string, token: string | undefined, input: DeleteInput) {
  try {
    const result = await mutation(`/api/v1/organizations/${input.organizationId}/deals/${input.dealId}`, token, "DELETE", { version: input.version });
    return result.enabled ? { id: input.dealId } : deleteDealForUser(userId, input);
  } catch (error) { return translateConflict(error); }
}
export async function addDealNoteThroughBackend(userId: string, token: string | undefined, input: NoteInput) {
  const result = await mutation(`/api/v1/organizations/${input.organizationId}/deals/${input.dealId}/notes`, token, "POST", { note: input.note });
  return result.enabled ? z.object({ id: z.uuid() }).parse(result.data) : addDealNoteForUser(userId, input);
}
export async function getSalesMetricsThroughBackend(userId: string, token: string | undefined, organizationId: string, range: AnalyticsRange) {
  const search = new URLSearchParams({ start: range.start, end_exclusive: range.endExclusive });
  const result = await backendRequest(`/api/v1/organizations/${organizationId}/deals/metrics?${search}`, token);
  return result.enabled ? metricsSchema.parse(result.data) : getSalesMetricsForUser(userId, organizationId, range);
}
