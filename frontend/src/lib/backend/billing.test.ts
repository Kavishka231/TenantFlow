import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ backendRequest: vi.fn(), getBillingForUser: vi.fn(), listActivePlansForUser: vi.fn() }));
vi.mock("@/lib/backend/client", () => ({ backendRequest: mocks.backendRequest }));
vi.mock("@/lib/billing/data", () => ({
  getBillingForUser: mocks.getBillingForUser, listActivePlansForUser: mocks.listActivePlansForUser,
}));

import { createCheckoutThroughBackend, getBillingThroughBackend, listPlansThroughBackend } from "./billing";

const organizationId = "10000000-0000-4000-8000-000000000001";
beforeEach(() => vi.clearAllMocks());

describe("billing FastAPI adapter", () => {
  it("maps owner billing state and plan minor units", async () => {
    mocks.backendRequest
      .mockResolvedValueOnce({ enabled: true, data: [{ id: organizationId, key: "starter", name: "Starter", description: "Plan", monthly_price_minor: 2900, currency: "USD", features: [], limits: {}, sort_order: 2 }] })
      .mockResolvedValueOnce({ enabled: true, data: { customer_id: "cus_Test123", subscription: { status: "active", cancel_at_period_end: false, current_period_end: "2026-12-01T00:00:00Z", plan_key: "starter", plan_name: "Starter" } } });
    const plans = await listPlansThroughBackend("user", "token", organizationId);
    const billing = await getBillingThroughBackend("user", "token", organizationId);
    expect(plans[0]?.monthlyPriceMinor).toBe(2900);
    expect(billing).toMatchObject({ customer: { stripeCustomerId: "cus_Test123" }, subscription: { planKey: "starter" } });
  });

  it("retains the Drizzle fallback", async () => {
    const fallback = { customer: null, subscription: null };
    mocks.backendRequest.mockResolvedValue({ enabled: false }); mocks.getBillingForUser.mockResolvedValue(fallback);
    await expect(getBillingThroughBackend("user", undefined, organizationId)).resolves.toBe(fallback);
  });

  it("sends only a plan key and accepts hosted Checkout URLs", async () => {
    mocks.backendRequest.mockResolvedValue({ enabled: true, data: { url: "https://checkout.stripe.com/c/pay/test" } });
    await expect(createCheckoutThroughBackend("token", organizationId, "growth")).resolves.toContain("checkout.stripe.com");
    expect(JSON.parse(mocks.backendRequest.mock.calls[0]?.[2]?.body as string)).toEqual({ plan_key: "growth" });
  });
});
