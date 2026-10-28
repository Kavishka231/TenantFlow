export type ExpenseAggregateRow = { amountMinor: number; currency: string; paidMinor: number };

export function mergeExpenseTotals(rows: ExpenseAggregateRow[]) {
  return rows.map((row) => ({ currency: row.currency, amountMinor: row.amountMinor, paidMinor: row.paidMinor }));
}
