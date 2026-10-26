import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { payloadSha256, stripeSubscriptionEventSchema, verifyStripeSignature } from "./webhook";

describe("Stripe webhook security", () => {
  it("accepts a current HMAC and rejects tampering", () => {
    const payload = '{"id":"evt_123"}';
    const secret = "whsec_test";
    const timestamp = 1_800_000_000;
    const digest = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
    const header = `t=${timestamp},v1=${digest}`;
    expect(verifyStripeSignature(payload, header, secret, timestamp)).toBe(true);
    expect(verifyStripeSignature(`${payload}x`, header, secret, timestamp)).toBe(false);
    expect(verifyStripeSignature(payload, header, secret, timestamp + 301)).toBe(false);
  });

  it("requires test mode and supported subscription events", () => {
    const base = {
      id: "evt_123", type: "customer.subscription.updated", created: 1,
      livemode: false, data: { object: {
        id: "sub_123", customer: "cus_123", status: "active",
        cancel_at_period_end: false, metadata: { tenantflowOrganizationId: "org" },
        items: { data: [{ price: { id: "price_123" } }] },
      } },
    };
    expect(stripeSubscriptionEventSchema.safeParse(base).success).toBe(true);
    expect(stripeSubscriptionEventSchema.safeParse({ ...base, livemode: true }).success).toBe(false);
  });

  it("hashes payloads deterministically", () => {
    expect(payloadSha256("tenantflow")).toMatch(/^[a-f0-9]{64}$/);
    expect(payloadSha256("tenantflow")).toBe(payloadSha256("tenantflow"));
  });
});
