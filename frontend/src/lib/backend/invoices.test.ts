import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  backendBinaryRequest: vi.fn(),
  backendRequest: vi.fn(),
  buildInvoicePdf: vi.fn(),
  createInvoiceForUser: vi.fn(),
  getInvoiceForUser: vi.fn(),
  listInvoiceCustomersForUser: vi.fn(),
  listInvoicesForUser: vi.fn(),
}));

vi.mock("@/lib/backend/client", () => ({
  backendBinaryRequest: mocks.backendBinaryRequest,
  backendRequest: mocks.backendRequest,
  BackendApiError: class BackendApiError extends Error {
    constructor(readonly status: number, readonly code: string | undefined) { super("Backend request failed"); }
  },
}));
vi.mock("@/lib/invoices/get", () => ({ getInvoiceForUser: mocks.getInvoiceForUser }));
vi.mock("@/lib/invoices/list", () => ({
  listInvoiceCustomersForUser: mocks.listInvoiceCustomersForUser,
  listInvoicesForUser: mocks.listInvoicesForUser,
}));
vi.mock("@/lib/invoices/mutations", () => ({
  cancelInvoiceForUser: vi.fn(),
  createInvoiceForUser: mocks.createInvoiceForUser,
  deleteInvoiceForUser: vi.fn(),
  InvoiceConflictError: class InvoiceConflictError extends Error {},
  recordInvoicePaymentForUser: vi.fn(),
  sendInvoiceForUser: vi.fn(),
  updateInvoiceForUser: vi.fn(),
}));
vi.mock("@/lib/invoices/pdf", () => ({ buildInvoicePdf: mocks.buildInvoicePdf }));

import { createInvoiceThroughBackend, getInvoicePdfThroughBackend, listInvoicesThroughBackend } from "./invoices";

const organizationId = "10000000-0000-4000-8000-000000000001";
const customerId = "20000000-0000-4000-8000-000000000001";
const invoiceId = "30000000-0000-4000-8000-000000000001";
const query = { page: 1, pageSize: 10 as const, q: "Acme", sort: "newest" as const, status: "sent" as const };

beforeEach(() => vi.clearAllMocks());

describe("invoice FastAPI adapter", () => {
  it("maps paginated invoice responses to the established UI contract", async () => {
    mocks.backendRequest.mockResolvedValue({ enabled: true, data: {
      invoices: [{ id: invoiceId, invoice_number: "INV-000001", customer_name: "Acme", status: "sent", currency: "USD", issue_date: "2026-01-01", due_date: "2026-01-31", total_minor: 1200, paid_minor: 200 }],
      page: 1, page_count: 2, page_size: 10, total: 11,
    } });
    const result = await listInvoicesThroughBackend("user", "token", organizationId, query);
    expect(result).toMatchObject({ pageCount: 2, total: 11 });
    expect(result.invoices[0]).toMatchObject({ invoiceNumber: "INV-000001", totalMinor: 1200 });
    expect(mocks.backendRequest.mock.calls[0]?.[0]).toContain("status=sent");
  });

  it("retains the Drizzle fallback when FastAPI is disabled", async () => {
    const fallback = { invoices: [], page: 1, pageCount: 1, total: 0 };
    mocks.backendRequest.mockResolvedValue({ enabled: false });
    mocks.listInvoicesForUser.mockResolvedValue(fallback);
    await expect(listInvoicesThroughBackend("user", undefined, organizationId, query)).resolves.toBe(fallback);
  });

  it("sends snake-case minor-unit payloads to FastAPI", async () => {
    mocks.backendRequest.mockResolvedValue({ enabled: true, data: { id: invoiceId, invoice_number: "INV-000001" } });
    await createInvoiceThroughBackend("user", "token", {
      organizationId, customerId, currency: "USD", issueDate: "2026-01-01", dueDate: "2026-01-31", notes: null,
      discountMinor: 100, taxRateBps: 1000, items: [{ description: "Consulting", quantity: 2, unitPriceMinor: 500 }],
    });
    expect(JSON.parse(mocks.backendRequest.mock.calls[0]?.[2]?.body as string)).toMatchObject({
      customer_id: customerId, discount_minor: 100, items: [{ unit_price_minor: 500 }],
    });
  });

  it("preserves private PDF download metadata from FastAPI", async () => {
    mocks.backendBinaryRequest.mockResolvedValue({
      enabled: true,
      data: Uint8Array.from([37, 80, 68, 70]).buffer,
      headers: new Headers({ "content-disposition": 'attachment; filename="INV-000001.pdf"' }),
    });
    const result = await getInvoicePdfThroughBackend("user", "token", organizationId, invoiceId, "Acme");
    expect(result?.contentDisposition).toContain("INV-000001.pdf");
    expect(result?.pdf.toString("ascii")).toBe("%PDF");
  });
});
