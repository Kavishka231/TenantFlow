import type { Metadata } from "next";
import { ArrowLeft, FileText, Plus, Search } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { InvoiceStatusBadge } from "@/components/invoices/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listInvoicesForUser } from "@/lib/invoices/list";
import { formatMinorUnits } from "@/lib/invoices/money";
import { invoiceListQuerySchema, type InvoiceListQuery } from "@/lib/invoices/query";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Invoices" };
type SearchParams = Record<string, string | string[] | undefined>;

async function Content({ params, searchParams }: { params: Promise<{ organizationId: string }>; searchParams: Promise<SearchParams> }) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login");
  const { organizationId } = await params; const organization = await authorize(user.id, organizationId); const raw = await searchParams;
  const query = invoiceListQuerySchema.parse({ page: first(raw.page), pageSize: first(raw.pageSize), q: first(raw.q), sort: first(raw.sort), status: first(raw.status) });
  const result = await listInvoicesForUser(user.id, organization.id, query); const canManage = organization.role !== "member";
  return <main className="min-h-screen bg-slate-50 px-6 py-10"><div className="mx-auto max-w-6xl space-y-6">
    <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost" }), "-ml-3")}><ArrowLeft /> Back to dashboard</Link>
    <div className="flex flex-wrap items-end justify-between gap-4"><header><p className="text-sm font-medium text-indigo-600">{organization.name}</p><h1 className="mt-1 text-3xl font-semibold">Invoices</h1><p className="mt-2 text-muted-foreground">{result.total} invoice{result.total === 1 ? "" : "s"}</p></header>{canManage ? <Link href={`/organizations/${organization.id}/invoices/new`} className={buttonVariants()}><Plus /> New invoice</Link> : null}</div>
    {first(raw.invoiceStatus) === "deleted" ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Draft invoice deleted.</p> : null}
    <Card><CardContent><form method="get" className="grid gap-3 md:grid-cols-[1fr_11rem_11rem_7rem_auto] md:items-end"><div className="relative"><label htmlFor="invoice-search" className="sr-only">Search invoices</label><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input id="invoice-search" name="q" defaultValue={query.q} placeholder="Number or customer…" className="pl-9" /></div><Select label="Status" name="status" value={query.status} options={[["all","All"],["draft","Draft"],["sent","Sent"],["partially_paid","Partially paid"],["paid","Paid"],["overdue","Overdue"],["cancelled","Cancelled"]]} /><Select label="Sort" name="sort" value={query.sort} options={[["newest","Newest"],["oldest","Oldest"],["due_soon","Due soon"],["amount_high","Highest amount"]]} /><Select label="Per page" name="pageSize" value={String(query.pageSize)} options={[["10","10"],["25","25"],["50","50"]]} /><button className={buttonVariants({ variant: "outline" })}>Apply</button></form></CardContent></Card>
    {result.invoices.length ? <div className="overflow-hidden rounded-2xl border bg-white"><div className="hidden grid-cols-[1fr_1.4fr_1fr_1fr_1fr] gap-4 border-b bg-slate-50 px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid"><span>Invoice</span><span>Customer</span><span>Due</span><span>Status</span><span className="text-right">Balance</span></div>{result.invoices.map((invoice) => <Link key={invoice.id} href={`/organizations/${organization.id}/invoices/${invoice.id}`} className="grid gap-2 border-b px-5 py-4 last:border-0 hover:bg-slate-50 md:grid-cols-[1fr_1.4fr_1fr_1fr_1fr] md:items-center md:gap-4"><span className="font-medium">{invoice.invoiceNumber}</span><span className="truncate text-sm">{invoice.customerName}</span><span className="text-sm text-muted-foreground">{invoice.dueDate}</span><span><InvoiceStatusBadge status={invoice.status} dueDate={invoice.dueDate} /></span><span className="font-medium md:text-right">{formatMinorUnits(invoice.totalMinor - invoice.paidMinor, invoice.currency)}</span></Link>)}</div> : <div className="rounded-3xl border border-dashed bg-white p-12 text-center"><FileText className="mx-auto size-10 text-indigo-600" /><h2 className="mt-4 text-xl font-semibold">No invoices found</h2><p className="mt-2 text-sm text-muted-foreground">Create a draft or adjust the current filters.</p></div>}
    <Pagination organizationId={organization.id} query={query} page={result.page} pageCount={result.pageCount} />
  </div></main>;
}
export default function Page(props: { params: Promise<{ organizationId: string }>; searchParams: Promise<SearchParams> }) { return <Suspense fallback={<div className="min-h-screen animate-pulse bg-slate-50" />}><Content {...props} /></Suspense>; }
async function authorize(userId: string, organizationId: string) { try { return await requireOrganizationPermission(userId, organizationId, "read_invoices"); } catch { notFound(); } }
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function Select({ label, name, options, value }: { label: string; name: string; options: [string,string][]; value: string }) { return <div><label htmlFor={`invoice-${name}`} className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label><select id={`invoice-${name}`} name={name} defaultValue={value} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">{options.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>; }
function Pagination({ organizationId, page, pageCount, query }: { organizationId: string; page: number; pageCount: number; query: InvoiceListQuery }) { if (pageCount <= 1) return null; const href=(next:number)=>{const p=new URLSearchParams({page:String(next),pageSize:String(query.pageSize),sort:query.sort,status:query.status});if(query.q)p.set("q",query.q);return `/organizations/${organizationId}/invoices?${p}`;}; return <nav aria-label="Invoice pagination" className="flex items-center justify-between"><Link href={href(Math.max(1,page-1))} className={cn(buttonVariants({variant:"outline"}),page<=1&&"pointer-events-none opacity-50")}>Previous</Link><span className="text-sm text-muted-foreground">Page {page} of {pageCount}</span><Link href={href(Math.min(pageCount,page+1))} className={cn(buttonVariants({variant:"outline"}),page>=pageCount&&"pointer-events-none opacity-50")}>Next</Link></nav>; }
