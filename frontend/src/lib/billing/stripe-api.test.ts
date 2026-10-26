import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("Stripe API adapter", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
    process.env.STRIPE_STARTER_PRICE_ID = "price_Starter123";
    process.env.STRIPE_GROWTH_PRICE_ID = "price_Growth123";
  });

  it("uses server-owned prices and tenant metadata for Checkout", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "cs_test_123", livemode: false, url: "https://checkout.stripe.com/c/pay/test",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { createCheckoutSession } = await import("./stripe-api");
    await createCheckoutSession({
      appUrl: "http://localhost:3000",
      customerId: "cus_Example123",
      organizationId: "00000000-0000-4000-8000-000000000001",
      planKey: "starter",
    });
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = new URLSearchParams(request.body as string);
    expect(body.get("line_items[0][price]")).toBe("price_Starter123");
    expect(body.get("metadata[tenantflowOrganizationId]")).toBe("00000000-0000-4000-8000-000000000001");
    expect(request.headers).toMatchObject({ "Idempotency-Key": expect.any(String) });
  });

  it("rejects live-mode responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "cs_live_123", livemode: true, url: "https://checkout.stripe.com/live",
    }), { status: 200 })));
    const { createCheckoutSession } = await import("./stripe-api");
    await expect(createCheckoutSession({
      appUrl: "http://localhost:3000",
      customerId: "cus_Example123",
      organizationId: "00000000-0000-4000-8000-000000000001",
      planKey: "growth",
    })).rejects.toThrow("Stripe could not process");
  });
});
