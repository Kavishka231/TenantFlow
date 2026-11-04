import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  backendRequest: vi.fn(), getExpenseForUser: vi.fn(), listExpenseCategoriesForUser: vi.fn(),
  listExpensesForUser: vi.fn(), getExpenseReportsForUser: vi.fn(),
}));
vi.mock("@/lib/backend/client", () => ({
  backendRequest: mocks.backendRequest,
  BackendApiError: class BackendApiError extends Error { constructor(readonly status: number, readonly code?: string) { super("failed"); } },
}));
vi.mock("@/lib/expenses/data", () => ({ getExpenseForUser: mocks.getExpenseForUser, listExpenseCategoriesForUser: mocks.listExpenseCategoriesForUser }));
vi.mock("@/lib/expenses/list", () => ({ listExpensesForUser: mocks.listExpensesForUser }));
vi.mock("@/lib/expenses/reports", () => ({ getExpenseReportsForUser: mocks.getExpenseReportsForUser }));
vi.mock("@/lib/expenses/mutations", () => ({
  attachExpenseReceiptForUser: vi.fn(), changeExpenseStatusForUser: vi.fn(), createExpenseForUser: vi.fn(),
  deleteExpenseForUser: vi.fn(), detachExpenseReceiptForUser: vi.fn(), updateExpenseForUser: vi.fn(),
  ExpenseConflictError: class ExpenseConflictError extends Error {},
}));

import { getExpenseReportsThroughBackend, listExpensesThroughBackend, uploadExpenseReceiptThroughBackend } from "./expenses";

const organizationId = "10000000-0000-4000-8000-000000000001";
const expenseId = "70000000-0000-4000-8000-000000000001";
const query = { categoryId: "all" as const, page: 1, pageSize: 10 as const, paymentMethod: "all" as const, q: "", sort: "newest" as const, status: "all" as const };

beforeEach(() => vi.clearAllMocks());

describe("expense FastAPI adapter", () => {
  it("maps paginated expense projections to the existing UI contract", async () => {
    mocks.backendRequest.mockResolvedValue({ enabled: true, data: { expenses: [{
      id: expenseId, amount_minor: 1250, currency: "USD", expense_date: "2026-11-01", vendor: "Acme",
      payment_method: "card", status: "paid", receipt_name: null, category_name: "Software", category_color: "#6366F1",
    }], page: 1, page_count: 1, page_size: 10, total: 1 } });
    const result = await listExpensesThroughBackend("user", "token", organizationId, query);
    expect(result.expenses[0]).toMatchObject({ amountMinor: 1250, categoryName: "Software", paymentMethod: "card" });
    expect(result.pageCount).toBe(1);
  });

  it("retains the Drizzle fallback when FastAPI is disabled", async () => {
    const fallback = { expenses: [], page: 1, pageCount: 1, pageSize: 10, total: 0 };
    mocks.backendRequest.mockResolvedValue({ enabled: false }); mocks.listExpensesForUser.mockResolvedValue(fallback);
    await expect(listExpensesThroughBackend("user", undefined, organizationId, query)).resolves.toBe(fallback);
  });

  it("keeps analytics totals separated by currency", async () => {
    mocks.backendRequest.mockResolvedValue({ enabled: true, data: {
      totals: [{ currency: "EUR", amount_minor: 1000, paid_minor: 500 }, { currency: "USD", amount_minor: 2000, paid_minor: 2000 }], monthly: [], categories: [],
    } });
    const reports = await getExpenseReportsThroughBackend("user", "token", organizationId, { start: "2026-11-01", end: "2026-11-30", endExclusive: "2026-12-01", preset: "custom" });
    expect(reports.totals).toEqual([{ currency: "EUR", amountMinor: 1000, paidMinor: 500 }, { currency: "USD", amountMinor: 2000, paidMinor: 2000 }]);
  });

  it("sends receipt bytes with version and safe metadata headers", async () => {
    mocks.backendRequest.mockResolvedValue({ enabled: true, data: {} });
    const file = new File(["receipt"], "invoice.pdf", { type: "application/pdf" });
    await uploadExpenseReceiptThroughBackend("token", { organizationId, expenseId, version: 3 }, file);
    expect(mocks.backendRequest.mock.calls[0]?.[2]).toMatchObject({ method: "PUT", headers: {
      "Content-Type": "application/pdf", "X-Receipt-Name": "invoice.pdf", "X-Expense-Version": "3",
    } });
  });
});
