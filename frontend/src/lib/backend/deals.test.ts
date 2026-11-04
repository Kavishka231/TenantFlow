import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  backendRequest: vi.fn(),
  createDealForUser: vi.fn(),
  getDealForUser: vi.fn(),
  getDealFormOptions: vi.fn(),
  getSalesMetricsForUser: vi.fn(),
  listPipelineForUser: vi.fn(),
}));

vi.mock("@/lib/backend/client", () => ({
  backendRequest: mocks.backendRequest,
  BackendApiError: class BackendApiError extends Error {
    constructor(readonly status: number, readonly code: string | undefined) { super("Backend failed"); }
  },
}));
vi.mock("@/lib/deals/data", () => ({
  getDealForUser: mocks.getDealForUser,
  getDealFormOptions: mocks.getDealFormOptions,
  listPipelineForUser: mocks.listPipelineForUser,
}));
vi.mock("@/lib/deals/metrics", () => ({ getSalesMetricsForUser: mocks.getSalesMetricsForUser }));
vi.mock("@/lib/deals/mutations", () => ({
  addDealNoteForUser: vi.fn(), createDealForUser: mocks.createDealForUser, deleteDealForUser: vi.fn(),
  transitionDealForUser: vi.fn(), updateDealForUser: vi.fn(), DealConflictError: class DealConflictError extends Error {},
}));

import { createDealThroughBackend, getPipelineThroughBackend, getSalesMetricsThroughBackend } from "./deals";

const organizationId = "10000000-0000-4000-8000-000000000001";
const customerId = "20000000-0000-4000-8000-000000000001";
const stageId = "50000000-0000-4000-8000-000000000001";
const dealId = "40000000-0000-4000-8000-000000000001";

beforeEach(() => vi.clearAllMocks());

describe("deal FastAPI adapter", () => {
  it("maps the pipeline projection to the existing Kanban contract", async () => {
    mocks.backendRequest.mockResolvedValue({ enabled: true, data: {
      stages: [{ id: stageId, organization_id: organizationId, name: "Lead", color: "#64748B", position: 1, kind: "open", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }],
      deals: [{ id: dealId, title: "Expansion", stage_id: stageId, customer_name: "Acme", assignee_name: null, value_minor: 250000, currency: "USD", expected_close_date: null, outcome: "open", version: 1 }],
    } });
    const pipeline = await getPipelineThroughBackend("user", "token", organizationId);
    expect(pipeline.deals[0]).toMatchObject({ stageId, customerName: "Acme", valueMinor: 250000 });
    expect(pipeline.stages[0]?.createdAt).toBeInstanceOf(Date);
  });

  it("retains the Drizzle pipeline fallback", async () => {
    const fallback = { stages: [], deals: [] };
    mocks.backendRequest.mockResolvedValue({ enabled: false });
    mocks.listPipelineForUser.mockResolvedValue(fallback);
    await expect(getPipelineThroughBackend("user", undefined, organizationId)).resolves.toBe(fallback);
  });

  it("sends tenant references and integer minor units in snake case", async () => {
    mocks.backendRequest.mockResolvedValue({ enabled: true, data: { id: dealId } });
    await createDealThroughBackend("user", "token", {
      organizationId, customerId, stageId, assignedUserId: null, title: "Expansion", description: null,
      valueMinor: 250000, currency: "USD", expectedCloseDate: null,
    });
    expect(JSON.parse(mocks.backendRequest.mock.calls[0]?.[2]?.body as string)).toMatchObject({
      customer_id: customerId, stage_id: stageId, value_minor: 250000,
    });
  });

  it("keeps sales totals separated by currency", async () => {
    mocks.backendRequest.mockResolvedValue({ enabled: true, data: {
      pipeline_value: [{ currency: "EUR", amount_minor: 1000, count: 1 }, { currency: "USD", amount_minor: 2000, count: 2 }],
      won_revenue: [{ currency: "USD", amount_minor: 500, count: 1 }], stages: [], won_deals: 1, lost_deals: 1, conversion_rate: 50,
    } });
    const metrics = await getSalesMetricsThroughBackend("user", "token", organizationId, { start: "2026-01-01", end: "2026-01-31", endExclusive: "2026-02-01", preset: "custom" });
    expect(metrics.pipelineValue).toEqual([
      { currency: "EUR", amountMinor: 1000, count: 1 }, { currency: "USD", amountMinor: 2000, count: 2 },
    ]);
    expect(metrics.conversionRate).toBe(50);
  });
});
