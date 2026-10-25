const MAX_SAFE_MINOR = Number.MAX_SAFE_INTEGER;

export type InvoiceCalculationItem = {
  quantity: number;
  unitPriceMinor: number;
};

export function calculateInvoiceTotals(
  items: readonly InvoiceCalculationItem[],
  discountMinor: number,
  taxRateBps: number,
) {
  const subtotal = items.reduce(
    (sum, item) => sum + BigInt(item.quantity) * BigInt(item.unitPriceMinor),
    BigInt(0),
  );
  const discount = BigInt(discountMinor);

  if (discount > subtotal) {
    throw new Error("The discount cannot exceed the invoice subtotal.");
  }

  const taxable = subtotal - discount;
  const tax =
    (taxable * BigInt(taxRateBps) + BigInt(5_000)) / BigInt(10_000);
  const total = taxable + tax;

  if (subtotal > BigInt(MAX_SAFE_MINOR) || total > BigInt(MAX_SAFE_MINOR)) {
    throw new Error("The invoice total exceeds the supported amount.");
  }

  return {
    subtotalMinor: Number(subtotal),
    taxMinor: Number(tax),
    totalMinor: Number(total),
  };
}

export function formatMinorUnits(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency",
  }).format(amountMinor / 100);
}
