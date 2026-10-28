import { CircleDollarSign, Clock3, ContactRound, FileText, ReceiptText } from "lucide-react";
import Link from "next/link";

import { CustomerGrowthChart, FinancialChart, InvoiceStatusChart } from "@/components/analytics/charts";
import { DateRangeFilter } from "@/components/analytics/date-range-filter";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MonthlyFinancialSeries } from "@/lib/analytics/buckets";
import type { DashboardMetrics } from "@/lib/analytics/metrics";
import type { CustomerGrowthPoint, RecentActivity } from "@/lib/analytics/models";
import type { getSalesMetricsForUser } from "@/lib/deals/metrics";
import type { AnalyticsRange } from "@/lib/analytics/range";
import { formatMinorUnits } from "@/lib/invoices/money";
import type { OrganizationSummary } from "@/lib/organizations/list";
import { cn } from "@/lib/utils";

export function AnalyticsDashboard({ organization, range, metrics, financial, insights, sales }: {
  organization: OrganizationSummary; range: AnalyticsRange; metrics: DashboardMetrics;
  financial: MonthlyFinancialSeries[];
  insights: { customerGrowth: CustomerGrowthPoint[]; invoiceStatuses: { status: string; count: number }[]; recentActivity: RecentActivity[] };
  sales: Awaited<ReturnType<typeof getSalesMetricsForUser>>;
}) {
  return <div className="space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium capitalize text-indigo-600">{organization.role} workspace</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{organization.name}</h1><p className="mt-2 text-sm text-muted-foreground">Business performance from {range.start} to {range.end}</p></div><DateRangeFilter range={range} /></div>
    <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard icon={ContactRound} label="Total customers" value={String(metrics.totalCustomers)} />
      <MetricCard icon={FileText} label="Invoices in range" value={String(metrics.totalInvoices)} />
      <MetricCard icon={CircleDollarSign} label="Payments received" value={<CurrencyValues values={metrics.paidAmounts} />} />
      <MetricCard icon={ReceiptText} label="Outstanding" value={<CurrencyValues values={metrics.outstandingBalances} />} />
      <MetricCard icon={Clock3} label="Overdue invoices" value={String(metrics.overdueInvoices)} alert={metrics.overdueInvoices > 0} />
    </section>
    <section className="grid gap-5 xl:grid-cols-[1.7fr_1fr]"><Card><CardHeader><CardTitle>Invoices and payments</CardTitle><CardDescription>Monthly totals remain separated by currency.</CardDescription></CardHeader><CardContent><FinancialChart series={financial} /></CardContent></Card><Card><CardHeader><CardTitle>Invoice status</CardTitle><CardDescription>Effective status for invoices in the selected range.</CardDescription></CardHeader><CardContent><InvoiceStatusChart rows={insights.invoiceStatuses} /></CardContent></Card></section>
    <section className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle>Customer growth</CardTitle><CardDescription>Cumulative customers, including the pre-range baseline.</CardDescription></CardHeader><CardContent><CustomerGrowthChart points={insights.customerGrowth} /></CardContent></Card><Card><CardHeader><CardTitle>Recent activity</CardTitle><CardDescription>Latest real customer, invoice, and payment events.</CardDescription></CardHeader><CardContent>{insights.recentActivity.length ? <ul className="divide-y">{insights.recentActivity.map(activity => <li key={`${activity.type}-${activity.id}`} className="flex items-start justify-between gap-3 py-3 first:pt-0"><div><p className="text-sm font-medium">{activity.title}</p><p className="mt-0.5 text-sm text-muted-foreground">{activity.description}</p></div><time className="shrink-0 text-xs text-muted-foreground" dateTime={activity.occurredAt.toISOString()}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(activity.occurredAt)}</time></li>)}</ul> : <div className="grid h-48 place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">No activity in this period.</div>}</CardContent></Card></section>
    <section className="grid gap-5 lg:grid-cols-[1fr_1.5fr]"><Card><CardHeader><CardTitle>Sales performance</CardTitle><CardDescription>Closed outcomes in the selected date range.</CardDescription></CardHeader><CardContent><div className="grid grid-cols-2 gap-4"><div><p className="text-xs uppercase text-muted-foreground">Conversion</p><p className="mt-1 text-3xl font-semibold">{sales.conversionRate}%</p></div><div><p className="text-xs uppercase text-muted-foreground">Won / lost</p><p className="mt-1 text-2xl font-semibold">{sales.wonDeals} / {sales.lostDeals}</p></div><div><p className="text-xs uppercase text-muted-foreground">Open pipeline</p><CurrencyValues values={sales.pipelineValue} /></div><div><p className="text-xs uppercase text-muted-foreground">Won revenue</p><CurrencyValues values={sales.wonRevenue} /></div></div></CardContent></Card><Card><CardHeader><CardTitle>Deals by stage</CardTitle><CardDescription>Current pipeline distribution.</CardDescription></CardHeader><CardContent><div className="space-y-3">{sales.stages.map(stage => <div key={stage.stageId}><div className="mb-1 flex justify-between text-sm"><span>{stage.stageName}</span><strong>{stage.count}</strong></div><div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ backgroundColor: stage.color, width: `${sales.stages.length ? Math.max(3, stage.count / Math.max(1, ...sales.stages.map(item => item.count)) * 100) : 0}%` }} /></div></div>)}</div></CardContent></Card></section>
    <section className="flex flex-wrap gap-3 rounded-2xl border bg-white p-5"><Link href={`/organizations/${organization.id}/pipeline`} className={buttonVariants()}>Sales pipeline</Link><Link href={`/organizations/${organization.id}/customers`} className={buttonVariants({ variant: "outline" })}>Customers</Link><Link href={`/organizations/${organization.id}/invoices`} className={buttonVariants({ variant: "outline" })}>Invoices</Link>{organization.role !== "member" ? <Link href={`/organizations/${organization.id}/team`} className={buttonVariants({ variant: "outline" })}>Team</Link> : null}{organization.role === "owner" ? <Link href={`/organizations/${organization.id}/billing`} className={buttonVariants({ variant: "outline" })}>Billing</Link> : null}<Link href="/organizations" className={cn(buttonVariants({ variant: "ghost" }), "ml-auto")}>Manage workspaces</Link></section>
  </div>;
}

function MetricCard({ icon: Icon, label, value, alert = false }: { icon: typeof ContactRound; label: string; value: React.ReactNode; alert?: boolean }) {
  return <Card><CardContent><div className={cn("grid size-9 place-items-center rounded-xl", alert ? "bg-red-50 text-red-600" : "bg-indigo-50 text-indigo-600")}><Icon className="size-4" /></div><p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><div className="mt-1 text-2xl font-semibold">{value}</div></CardContent></Card>;
}

function CurrencyValues({ values }: { values: { currency: string; amountMinor: number }[] }) {
  if (!values.length) return <span>—</span>;
  return <span className="flex flex-col gap-1">{values.map(value => <span key={value.currency} className="text-lg">{formatMinorUnits(value.amountMinor, value.currency)}</span>)}</span>;
}
