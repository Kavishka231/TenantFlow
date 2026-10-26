import type { MonthlyFinancialSeries } from "@/lib/analytics/buckets";
import type { CustomerGrowthPoint } from "@/lib/analytics/models";
import { formatMinorUnits } from "@/lib/invoices/money";

function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}

export function FinancialChart({ series }: { series: MonthlyFinancialSeries[] }) {
  if (!series.length) return <EmptyChart message="No invoice or payment data in this period." />;
  return <div className="space-y-6">{series.map((currencySeries) => {
    const maximum = Math.max(1, ...currencySeries.points.flatMap(point => [point.invoicedMinor, point.paidMinor]));
    return <div key={currencySeries.currency}><div className="mb-3 flex items-center justify-between"><p className="font-medium">{currencySeries.currency}</p><div className="flex gap-3 text-xs text-muted-foreground"><span><i className="mr-1 inline-block size-2 rounded-full bg-indigo-500" />Invoiced</span><span><i className="mr-1 inline-block size-2 rounded-full bg-emerald-500" />Paid</span></div></div><div className="flex h-52 items-end gap-2 overflow-x-auto border-b border-l px-3 pt-3">{currencySeries.points.map(point => <div key={point.month} className="flex h-full min-w-12 flex-1 flex-col justify-end"><div className="flex flex-1 items-end justify-center gap-1" title={`${monthLabel(point.month)}: invoiced ${formatMinorUnits(point.invoicedMinor, currencySeries.currency)}, paid ${formatMinorUnits(point.paidMinor, currencySeries.currency)}`}><span className="w-3 rounded-t bg-indigo-500" style={{ height: `${Math.max(point.invoicedMinor ? 3 : 0, point.invoicedMinor / maximum * 100)}%` }} /><span className="w-3 rounded-t bg-emerald-500" style={{ height: `${Math.max(point.paidMinor ? 3 : 0, point.paidMinor / maximum * 100)}%` }} /></div><span className="py-2 text-center text-[10px] text-muted-foreground">{monthLabel(point.month)}</span></div>)}</div></div>;
  })}</div>;
}

export function CustomerGrowthChart({ points }: { points: CustomerGrowthPoint[] }) {
  const maximum = Math.max(1, ...points.map(point => point.totalCustomers));
  if (!points.some(point => point.totalCustomers)) return <EmptyChart message="No customer growth data yet." />;
  return <div className="flex h-56 items-end gap-2 border-b border-l px-3 pt-3">{points.map(point => <div key={point.month} className="flex h-full min-w-10 flex-1 flex-col justify-end text-center"><div className="flex flex-1 items-end justify-center"><span className="w-6 rounded-t bg-violet-500" style={{ height: `${Math.max(4, point.totalCustomers / maximum * 100)}%` }} title={`${point.totalCustomers} total, ${point.newCustomers} new`} /></div><span className="py-2 text-[10px] text-muted-foreground">{monthLabel(point.month)}</span></div>)}</div>;
}

export function InvoiceStatusChart({ rows }: { rows: { status: string; count: number }[] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (!total) return <EmptyChart message="No invoices in this period." />;
  const colors: Record<string, string> = { draft: "bg-slate-400", sent: "bg-blue-500", partially_paid: "bg-amber-500", paid: "bg-emerald-500", overdue: "bg-red-500", cancelled: "bg-zinc-400" };
  return <div className="space-y-4">{rows.map(row => <div key={row.status}><div className="mb-1 flex justify-between text-sm"><span className="capitalize">{row.status.replace("_", " ")}</span><span className="font-medium">{row.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${colors[row.status] ?? "bg-indigo-500"}`} style={{ width: `${row.count / total * 100}%` }} /></div></div>)}</div>;
}

function EmptyChart({ message }: { message: string }) {
  return <div className="grid h-48 place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">{message}</div>;
}
