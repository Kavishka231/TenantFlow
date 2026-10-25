import { describe, expect, it } from "vitest";

import type { InvoiceDetail } from "./get";
import { buildInvoicePdf } from "./pdf";

function invoiceFixture(itemCount = 1): InvoiceDetail {
  return {
    cancelledAt: null,
    createdAt: new Date("2027-01-01T00:00:00Z"),
    currency: "USD",
    customerCompany: "Example Co",
    customerEmail: "billing@example.com",
    customerId: "00000000-0000-4000-8000-000000000002",
    customerName: "Example Customer",
    discountMinor: 0,
    dueDate: "2027-01-31",
    id: "00000000-0000-4000-8000-000000000003",
    invoiceNumber: "INV-000001",
    issueDate: "2027-01-01",
    items: Array.from({ length: itemCount }, (_, index) => ({
      createdAt: new Date("2027-01-01T00:00:00Z"),
      description: `Service ${index + 1}`,
      id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
      invoiceId: "00000000-0000-4000-8000-000000000003",
      lineTotalMinor: 1_000,
      organizationId: "00000000-0000-4000-8000-000000000001",
      position: index + 1,
      quantity: 1,
      unitPriceMinor: 1_000,
    })),
    notes: "Thank you",
    paidMinor: 0,
    payments: [],
    sentAt: null,
    status: "draft",
    subtotalMinor: itemCount * 1_000,
    taxMinor: 0,
    taxRateBps: 0,
    totalMinor: itemCount * 1_000,
    updatedAt: new Date("2027-01-01T00:00:00Z"),
    version: 1,
  };
}

describe("invoice PDF", () => {
  it("creates a valid downloadable PDF containing invoice details", () => {
    const pdf = buildInvoicePdf(invoiceFixture(), "TenantFlow Demo").toString("ascii");
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("INVOICE INV-000001");
    expect(pdf.endsWith("%%EOF")).toBe(true);
  });

  it("paginates long invoices", () => {
    expect(buildInvoicePdf(invoiceFixture(60), "TenantFlow Demo").toString("ascii")).toMatch(
      /\/Type \/Pages .*\/Count [3-9]/,
    );
  });
});
