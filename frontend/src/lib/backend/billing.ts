import "server-only";

import { z } from "zod";

import { backendRequest } from "@/lib/backend/client";
import { getBillingForUser, listActivePlansForUser } from "@/lib/billing/data";
import { isStripeConfigured } from "@/lib/billing/env";

const planSchema = z.object({
  id: z.uuid(), key: z.string(), name: z.string(), description: z.string(),
  monthly_price_minor: z.number().int(), currency: z.string(), features: z.array(z.string()),
  limits: z.record(z.string(), z.unknown()), sort_order: z.number().int(),
}).transform(({ monthly_price_minor, sort_order, ...plan }) => ({
  ...plan, monthlyPriceMinor: monthly_price_minor, sortOrder: sort_order, active: true,
  createdAt: new Date(0), updatedAt: new Date(0),
}));
const statusSchema = z.enum(["incomplete", "incomplete_expired", "trialing", "active", "past_due", "canceled", "unpaid", "paused"]);
const billingSchema = z.object({
  customer_id: z.string().nullable(), stripe_configured: z.boolean(), subscription: z.object({
    status: statusSchema, cancel_at_period_end: z.boolean(), current_period_end: z.coerce.date().nullable(),
    plan_key: z.string(), plan_name: z.string(),
  }).nullable(),
}).transform(({ customer_id, stripe_configured, subscription }) => ({
  customer: customer_id ? { stripeCustomerId: customer_id } : null,
  stripeConfigured: stripe_configured,
  subscription: subscription ? {
    status: subscription.status, cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: subscription.current_period_end, planKey: subscription.plan_key,
    planName: subscription.plan_name,
  } : null,
}));

export async function listPlansThroughBackend(userId: string, token: string | undefined, organizationId: string) {
  const result = await backendRequest(`/api/v1/organizations/${organizationId}/billing/plans`, token);
  return result.enabled ? z.array(planSchema).parse(result.data) : listActivePlansForUser(userId);
}
export async function getBillingThroughBackend(userId: string, token: string | undefined, organizationId: string) {
  const result = await backendRequest(`/api/v1/organizations/${organizationId}/billing`, token);
  if (result.enabled) return billingSchema.parse(result.data);
  return { ...await getBillingForUser(userId, organizationId), stripeConfigured: isStripeConfigured() };
}
export async function createCheckoutThroughBackend(token: string | undefined, organizationId: string, planKey: "starter" | "growth") {
  const result = await backendRequest(`/api/v1/organizations/${organizationId}/billing/checkout`, token, {
    method: "POST", body: JSON.stringify({ plan_key: planKey }),
  });
  return result.enabled ? z.object({ url: z.url() }).parse(result.data).url : null;
}
export async function createPortalThroughBackend(token: string | undefined, organizationId: string) {
  const result = await backendRequest(`/api/v1/organizations/${organizationId}/billing/portal`, token, { method: "POST" });
  return result.enabled ? z.object({ url: z.url() }).parse(result.data).url : null;
}
