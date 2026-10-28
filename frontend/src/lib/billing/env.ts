import "server-only";

import { z } from "zod";

const stripeEnvSchema = z.object({
  STRIPE_SECRET_KEY: z.string().regex(/^sk_test_[A-Za-z0-9_]+$/),
  STRIPE_WEBHOOK_SECRET: z.string().regex(/^whsec_[A-Za-z0-9_]+$/),
  STRIPE_STARTER_PRICE_ID: z.string().regex(/^price_[A-Za-z0-9]+$/),
  STRIPE_GROWTH_PRICE_ID: z.string().regex(/^price_[A-Za-z0-9]+$/),
});

export function getStripeEnv() {
  return stripeEnvSchema.parse({
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_STARTER_PRICE_ID: process.env.STRIPE_STARTER_PRICE_ID,
    STRIPE_GROWTH_PRICE_ID: process.env.STRIPE_GROWTH_PRICE_ID,
  });
}

export function isStripeConfigured() {
  return stripeEnvSchema.safeParse(process.env).success;
}
