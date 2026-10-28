const AMOUNT_PATTERN = /^\d{1,10}(?:\.\d{1,2})?$/;

export function parseExpenseAmount(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : String(value ?? "");
  if (!AMOUNT_PATTERN.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount >= 1 && amount <= 1_000_000_000_000
    ? amount
    : null;
}

export function expenseAmountInput(amountMinor: number) {
  return (amountMinor / 100).toFixed(2);
}
