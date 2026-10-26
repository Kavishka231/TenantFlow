import "server-only";

import { getStripeEnv } from "./env";
import type { BillingPlanKey } from "./plans";

type StripeObject = Record<string, unknown> & { id: string; livemode?: boolean };

export class StripeApiError extends Error {
  constructor(message = "Stripe could not process the billing request.") {
    super(message);
    this.name = "StripeApiError";
  }
}

async function stripeRequest<T extends StripeObject>(
  path: string,
  body: URLSearchParams,
  idempotencyKey?: string,
): Promise<T> {
  const { STRIPE_SECRET_KEY } = getStripeEnv();
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body,
    cache: "no-store",
  });
  const data = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok || !data.id || data.livemode === true) {
    throw new StripeApiError(data.error?.message);
  }
  return data;
}

export function priceIdForPlan(planKey: Exclude<BillingPlanKey, "free">) {
  const env = getStripeEnv();
  return planKey === "starter"
    ? env.STRIPE_STARTER_PRICE_ID
    : env.STRIPE_GROWTH_PRICE_ID;
}

export function planForPriceId(priceId: string) {
  const env = getStripeEnv();
  if (priceId === env.STRIPE_STARTER_PRICE_ID) return "starter" as const;
  if (priceId === env.STRIPE_GROWTH_PRICE_ID) return "growth" as const;
  return null;
}

export function createStripeCustomer(input: {
  organizationId: string;
  organizationName: string;
}) {
  const body = new URLSearchParams({
    name: input.organizationName,
    "metadata[tenantflowOrganizationId]": input.organizationId,
  });
  return stripeRequest<{ id: string; livemode: boolean }>(
    "customers",
    body,
    `tenantflow-customer-${input.organizationId}`,
  );
}

export function createCheckoutSession(input: {
  appUrl: string;
  customerId: string;
  organizationId: string;
  planKey: "starter" | "growth";
}) {
  const billingUrl = `${input.appUrl}/organizations/${input.organizationId}/billing`;
  const body = new URLSearchParams({
    mode: "subscription",
    customer: input.customerId,
    client_reference_id: input.organizationId,
    "line_items[0][price]": priceIdForPlan(input.planKey),
    "line_items[0][quantity]": "1",
    success_url: `${billingUrl}?checkout=success`,
    cancel_url: `${billingUrl}?checkout=cancelled`,
    "metadata[tenantflowOrganizationId]": input.organizationId,
    "metadata[tenantflowPlanKey]": input.planKey,
    "subscription_data[metadata][tenantflowOrganizationId]": input.organizationId,
  });
  return stripeRequest<{ id: string; livemode: boolean; url: string }>(
    "checkout/sessions",
    body,
    `tenantflow-checkout-${input.organizationId}-${input.planKey}`,
  );
}

export function createPortalSession(input: {
  appUrl: string;
  customerId: string;
  organizationId: string;
}) {
  const body = new URLSearchParams({
    customer: input.customerId,
    return_url: `${input.appUrl}/organizations/${input.organizationId}/billing`,
  });
  return stripeRequest<{ id: string; livemode: boolean; url: string }>(
    "billing_portal/sessions",
    body,
  );
}
