import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  backendRequest: vi.fn(),
  createCustomerForUser: vi.fn(),
  deleteCustomerForUser: vi.fn(),
  getCustomerForUser: vi.fn(),
  listCustomersForUser: vi.fn(),
  updateCustomerForUser: vi.fn(),
}));

vi.mock("@/lib/backend/client", () => ({
  backendRequest: mocks.backendRequest,
  BackendApiError: class BackendApiError extends Error {
    constructor(
      readonly status: number,
      readonly code: string | undefined,
    ) {
      super("Backend request failed");
    }
  },
}));

vi.mock("@/lib/customers/get", () => ({
  getCustomerForUser: mocks.getCustomerForUser,
}));
vi.mock("@/lib/customers/list", () => ({
  listCustomersForUser: mocks.listCustomersForUser,
}));
vi.mock("@/lib/customers/mutations", () => ({
  createCustomerForUser: mocks.createCustomerForUser,
  deleteCustomerForUser: mocks.deleteCustomerForUser,
  updateCustomerForUser: mocks.updateCustomerForUser,
  CustomerConflictError: class CustomerConflictError extends Error {},
}));

import { BackendApiError } from "@/lib/backend/client";
import {
  listCustomersThroughBackend,
  updateCustomerThroughBackend,
} from "@/lib/backend/customers";
import { CustomerConflictError } from "@/lib/customers/mutations";

const organizationId = "10000000-0000-4000-8000-000000000001";
const customerId = "20000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000001";
const query = {
  page: 1,
  pageSize: 10 as const,
  q: "Acme",
  sort: "name_asc" as const,
  status: "active" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("customer FastAPI adapter", () => {
  it("maps paginated FastAPI responses to the existing UI contract", async () => {
    mocks.backendRequest.mockResolvedValue({
      enabled: true,
      data: {
        customers: [
          {
            id: customerId,
            name: "Acme",
            email: null,
            phone: null,
            company: null,
            status: "active",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-02T00:00:00Z",
          },
        ],
        page: 1,
        page_count: 3,
        page_size: 10,
        total: 21,
      },
    });

    const result = await listCustomersThroughBackend(
      userId,
      "token",
      organizationId,
      query,
    );

    expect(result).toMatchObject({ pageCount: 3, pageSize: 10, total: 21 });
    expect(result.customers[0]?.updatedAt).toBeInstanceOf(Date);
    expect(mocks.backendRequest).toHaveBeenCalledWith(
      expect.stringContaining(
        `/api/v1/organizations/${organizationId}/customers?`,
      ),
      "token",
    );
    expect(mocks.backendRequest.mock.calls[0]?.[0]).toContain("status=active");
  });

  it("retains the Drizzle fallback when FastAPI is disabled", async () => {
    const fallback = {
      customers: [],
      page: 1,
      pageCount: 1,
      pageSize: 10,
      total: 0,
    };
    mocks.backendRequest.mockResolvedValue({ enabled: false });
    mocks.listCustomersForUser.mockResolvedValue(fallback);

    await expect(
      listCustomersThroughBackend(
        userId,
        undefined,
        organizationId,
        query,
      ),
    ).resolves.toBe(fallback);
    expect(mocks.listCustomersForUser).toHaveBeenCalledWith(
      userId,
      organizationId,
      query,
    );
  });

  it("preserves optimistic conflict behavior for existing forms", async () => {
    mocks.backendRequest.mockRejectedValue(
      new BackendApiError(409, "customer_version_conflict"),
    );

    await expect(
      updateCustomerThroughBackend(userId, "token", {
        organizationId,
        customerId,
        name: "Acme",
        email: null,
        phone: null,
        company: null,
        address: null,
        status: "active",
        notes: null,
        version: 2,
      }),
    ).rejects.toBeInstanceOf(CustomerConflictError);
  });
});
