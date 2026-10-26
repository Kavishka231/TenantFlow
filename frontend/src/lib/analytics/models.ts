export type CustomerGrowthPoint = { month: string; newCustomers: number; totalCustomers: number };

export function buildCustomerGrowth(
  months: string[],
  baseline: number,
  rows: { month: string; count: number }[],
): CustomerGrowthPoint[] {
  let running = baseline;
  return months.map((month) => {
    const newCustomers = rows.find((row) => row.month === month)?.count ?? 0;
    running += newCustomers;
    return { month, newCustomers, totalCustomers: running };
  });
}

export type RecentActivity = {
  id: string;
  type: "customer_created" | "invoice_created" | "payment_recorded";
  title: string;
  description: string;
  occurredAt: Date;
};

export function mergeRecentActivity(groups: RecentActivity[][], limit = 8) {
  return groups.flat().sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, limit);
}
