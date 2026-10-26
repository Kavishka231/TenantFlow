import "server-only";

import { sql } from "drizzle-orm";

import { withSystemTransaction } from "@/db/client";
import { planForPriceId } from "@/lib/billing/stripe-api";
import { payloadSha256, stripeSubscriptionEventSchema, unixTimestamp } from "@/lib/billing/webhook";

export async function processStripeWebhookPayload(payload: string) {
  const event = stripeSubscriptionEventSchema.parse(JSON.parse(payload) as unknown);
  const subscription = event.data.object;
  const priceId = subscription.items.data[0]!.price.id;
  const planKey = planForPriceId(priceId);
  const organizationId = subscription.metadata.tenantflowOrganizationId;
  if (!planKey || !organizationId) throw new Error("Stripe subscription cannot be mapped to a TenantFlow plan.");

  const result = await withSystemTransaction((transaction) => transaction.execute(sql`
    select public.process_stripe_subscription_event(
      ${event.id}::text,
      ${event.type}::text,
      ${organizationId}::uuid,
      ${planKey}::text,
      ${subscription.customer}::text,
      ${subscription.id}::text,
      ${priceId}::text,
      ${subscription.status}::public.subscription_status,
      ${subscription.cancel_at_period_end}::boolean,
      ${unixTimestamp(subscription.current_period_start)}::timestamptz,
      ${unixTimestamp(subscription.current_period_end)}::timestamptz,
      ${unixTimestamp(subscription.ended_at)}::timestamptz,
      ${event.created}::bigint,
      ${payloadSha256(payload)}::text
    ) as processed
  `));
  return Boolean((result[0] as { processed?: boolean } | undefined)?.processed);
}
