import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

const stripeStatuses = [
  "incomplete", "incomplete_expired", "trialing", "active", "past_due",
  "canceled", "unpaid", "paused",
] as const;

export const supportedStripeSubscriptionEvents = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
] as const;

const subscriptionObjectSchema = z.object({
  id: z.string().regex(/^sub_[A-Za-z0-9]+$/),
  customer: z.string().regex(/^cus_[A-Za-z0-9]+$/),
  status: z.enum(stripeStatuses),
  cancel_at_period_end: z.boolean().default(false),
  current_period_start: z.number().int().nonnegative().nullish(),
  current_period_end: z.number().int().nonnegative().nullish(),
  ended_at: z.number().int().nonnegative().nullish(),
  metadata: z.record(z.string(), z.string()).default({}),
  items: z.object({
    data: z.array(z.object({ price: z.object({ id: z.string().regex(/^price_[A-Za-z0-9]+$/) }) })).min(1),
  }),
});

export const stripeSubscriptionEventSchema = z.object({
  id: z.string().regex(/^evt_[A-Za-z0-9]+$/),
  type: z.enum(supportedStripeSubscriptionEvents),
  created: z.number().int().nonnegative(),
  livemode: z.literal(false),
  data: z.object({ object: subscriptionObjectSchema }),
});

export function isSupportedStripeSubscriptionEvent(type: unknown) {
  return z.enum(supportedStripeSubscriptionEvents).safeParse(type).success;
}

export function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
) {
  const parts = signatureHeader.split(",").map((part) => part.split("=", 2));
  const timestamp = Number(parts.find(([key]) => key === "t")?.[1]);
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest();
  return signatures.some((candidate) => {
    if (!candidate || !/^[a-f0-9]{64}$/i.test(candidate)) return false;
    const actual = Buffer.from(candidate, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}

export function payloadSha256(payload: string) {
  return createHash("sha256").update(payload).digest("hex");
}

export function unixTimestamp(value: number | null | undefined) {
  return value == null ? null : new Date(value * 1000);
}
