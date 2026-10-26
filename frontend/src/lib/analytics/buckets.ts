import type { CurrencyMetric } from "./metrics";

export type MonthlyCurrencyRow = CurrencyMetric & { month: string };
export type MonthlyFinancialPoint = {
  month: string;
  invoicedMinor: number;
  paidMinor: number;
};
export type MonthlyFinancialSeries = {
  currency: string;
  points: MonthlyFinancialPoint[];
};

export function monthKeys(start: string, end: string) {
  const cursor = new Date(`${start.slice(0, 7)}-01T00:00:00.000Z`);
  const last = new Date(`${end.slice(0, 7)}-01T00:00:00.000Z`);
  const result: string[] = [];
  while (cursor <= last) {
    result.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
}

export function buildMonthlyFinancialSeries(
  months: string[],
  invoiced: MonthlyCurrencyRow[],
  paid: MonthlyCurrencyRow[],
): MonthlyFinancialSeries[] {
  const currencies = [...new Set([...invoiced, ...paid].map((row) => row.currency))].sort();
  return currencies.map((currency) => ({
    currency,
    points: months.map((month) => ({
      month,
      invoicedMinor: invoiced.find((row) => row.currency === currency && row.month === month)?.amountMinor ?? 0,
      paidMinor: paid.find((row) => row.currency === currency && row.month === month)?.amountMinor ?? 0,
    })),
  }));
}
