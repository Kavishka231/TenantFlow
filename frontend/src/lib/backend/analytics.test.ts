import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ backendRequest: vi.fn(), metrics: vi.fn(), financial: vi.fn(), insights: vi.fn() }));
vi.mock("@/lib/backend/client", () => ({ backendRequest: mocks.backendRequest }));
vi.mock("@/lib/analytics/metrics", () => ({ getDashboardMetricsForUser: mocks.metrics }));
vi.mock("@/lib/analytics/financial", () => ({ getMonthlyFinancialAnalyticsForUser: mocks.financial }));
vi.mock("@/lib/analytics/insights", () => ({ getDashboardInsightsForUser: mocks.insights }));

import { getDashboardAnalyticsThroughBackend } from "./analytics";

const organizationId = "10000000-0000-4000-8000-000000000001";
const range = { start: "2026-01-01", end: "2026-01-31", endExclusive: "2026-02-01", preset: "custom" as const };
beforeEach(() => vi.clearAllMocks());

describe("dashboard analytics FastAPI adapter", () => {
  it("maps currency-separated financial and activity projections", async () => {
    mocks.backendRequest.mockResolvedValue({ enabled: true, data: {
      metrics: { total_customers: 2, total_invoices: 3, overdue_invoices: 1, paid_amounts: [{ currency: "USD", amount_minor: 500 }], outstanding_balances: [{ currency: "EUR", amount_minor: 700 }] },
      financial: [{ currency: "USD", points: [{ month: "2026-01", invoiced_minor: 1000, paid_minor: 500 }] }],
      insights: { customer_growth: [{ month: "2026-01", new_customers: 1, total_customers: 2 }], invoice_statuses: [{ status: "paid", count: 1 }], recent_activity: [{ id: organizationId, type: "customer_created", title: "Customer added", description: "Acme", occurred_at: "2026-01-02T00:00:00Z" }] },
    } });
    const result = await getDashboardAnalyticsThroughBackend("user", "token", organizationId, range);
    expect(result.metrics.paidAmounts).toEqual([{ currency: "USD", amountMinor: 500 }]);
    expect(result.financial[0]?.points[0]).toMatchObject({ invoicedMinor: 1000, paidMinor: 500 });
    expect(result.insights.recentActivity[0]?.occurredAt).toBeInstanceOf(Date);
  });

  it("retains all three TypeScript analytics fallbacks", async () => {
    mocks.backendRequest.mockResolvedValue({ enabled: false });
    mocks.metrics.mockResolvedValue({ key: "metrics" }); mocks.financial.mockResolvedValue([]); mocks.insights.mockResolvedValue({ key: "insights" });
    const result = await getDashboardAnalyticsThroughBackend("user", undefined, organizationId, range);
    expect(result).toEqual({ metrics: { key: "metrics" }, financial: [], insights: { key: "insights" } });
  });
});
