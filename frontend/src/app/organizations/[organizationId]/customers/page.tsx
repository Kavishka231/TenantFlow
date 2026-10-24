import type { Metadata } from "next";
import { ArrowLeft, Mail, Phone, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { CustomerStatusBadge } from "@/components/customers/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { customerListQuerySchema, type CustomerListQuery } from "@/lib/customers/query";
import { listCustomersForUser } from "@/lib/customers/list";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Customers" };

type CustomerSearchParams = Record<string, string | string[] | undefined>;

async function CustomersContent({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<CustomerSearchParams>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { organizationId } = await params;
  const organization = await authorizeCustomers(user.id, organizationId);
  const rawQuery = await searchParams;
  const query = customerListQuerySchema.parse({
    page: first(rawQuery.page),
    pageSize: first(rawQuery.pageSize),
    q: first(rawQuery.q),
    sort: first(rawQuery.sort),
    status: first(rawQuery.status),
  });
  const result = await listCustomersForUser(user.id, organization.id, query);
  const canManage = organization.role !== "member";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost" }), "-ml-3")}>
          <ArrowLeft aria-hidden="true" /> Back to dashboard
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <header>
            <p className="text-sm font-medium capitalize text-indigo-600">
              {organization.name} · {organization.role}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Customers</h1>
            <p className="mt-2 text-muted-foreground">
              {result.total} customer{result.total === 1 ? "" : "s"} in this workspace
            </p>
          </header>
          {canManage ? (
            <Link href={`/organizations/${organization.id}/customers/new`} className={buttonVariants()}>
              <Plus aria-hidden="true" /> New customer
            </Link>
          ) : null}
        </div>

        {first(rawQuery.customerStatus) === "deleted" ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" role="status">
            Customer deleted.
          </p>
        ) : null}

        <Card>
          <CardContent>
            <form method="get" className="grid gap-3 md:grid-cols-[1fr_10rem_12rem_7rem_auto] md:items-end">
              <div className="relative">
                <label htmlFor="customer-search" className="sr-only">Search customers</label>
                <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
                <Input id="customer-search" name="q" defaultValue={query.q} maxLength={100} placeholder="Search name, email, company…" className="pl-9" />
              </div>
              <Select name="status" label="Status" value={query.status} options={[
                ["all", "All statuses"], ["lead", "Lead"], ["active", "Active"], ["inactive", "Inactive"],
              ]} />
              <Select name="sort" label="Sort" value={query.sort} options={[
                ["name_asc", "Name A–Z"], ["name_desc", "Name Z–A"], ["newest", "Newest"], ["oldest", "Oldest"], ["recently_updated", "Recently updated"],
              ]} />
              <Select name="pageSize" label="Per page" value={String(query.pageSize)} options={[["10", "10"], ["25", "25"], ["50", "50"]]} />
              <button type="submit" className={buttonVariants({ variant: "outline" })}>Apply</button>
            </form>
          </CardContent>
        </Card>

        {result.customers.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.customers.map((customer) => (
              <Link key={customer.id} href={`/organizations/${organization.id}/customers/${customer.id}`} className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold group-hover:text-indigo-700">{customer.name}</h2>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{customer.company ?? "No company"}</p>
                  </div>
                  <CustomerStatusBadge status={customer.status} />
                </div>
                <div className="mt-5 space-y-2 text-sm text-muted-foreground">
                  <Contact icon={Mail} value={customer.email ?? "No email"} />
                  <Contact icon={Phone} value={customer.phone ?? "No phone"} />
                </div>
                <p className="mt-5 text-xs text-muted-foreground">Updated {customer.updatedAt.toLocaleDateString()}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed bg-white p-12 text-center">
            <Users className="mx-auto size-10 text-indigo-600" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-semibold">No customers found</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {query.q || query.status !== "all" ? "Try changing the search or status filter." : "Add the first customer to this workspace."}
            </p>
          </div>
        )}

        <Pagination organizationId={organization.id} query={query} page={result.page} pageCount={result.pageCount} />
      </div>
    </main>
  );
}

export default function CustomersPage(props: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<CustomerSearchParams>;
}) {
  return <Suspense fallback={<CustomersLoading />}><CustomersContent {...props} /></Suspense>;
}

async function authorizeCustomers(userId: string, organizationId: string) {
  try { return await requireOrganizationPermission(userId, organizationId, "read_customers"); }
  catch { notFound(); }
}

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

function Select({ label, name, options, value }: { label: string; name: string; options: [string, string][]; value: string }) {
  return <div><label htmlFor={`customer-${name}`} className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label><select id={`customer-${name}`} name={name} defaultValue={value} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></div>;
}

function Contact({ icon: Icon, value }: { icon: typeof Mail; value: string }) {
  return <p className="flex items-center gap-2 truncate"><Icon className="size-4 shrink-0" aria-hidden="true" /><span className="truncate">{value}</span></p>;
}

function Pagination({ organizationId, page, pageCount, query }: { organizationId: string; page: number; pageCount: number; query: CustomerListQuery }) {
  if (pageCount <= 1) return null;
  const href = (nextPage: number) => {
    const params = new URLSearchParams({ page: String(nextPage), pageSize: String(query.pageSize), sort: query.sort, status: query.status });
    if (query.q) params.set("q", query.q);
    return `/organizations/${organizationId}/customers?${params}`;
  };
  return <nav aria-label="Customer pagination" className="flex items-center justify-between"><Link href={href(Math.max(1, page - 1))} aria-disabled={page <= 1} className={cn(buttonVariants({ variant: "outline" }), page <= 1 && "pointer-events-none opacity-50")}>Previous</Link><span className="text-sm text-muted-foreground">Page {page} of {pageCount}</span><Link href={href(Math.min(pageCount, page + 1))} aria-disabled={page >= pageCount} className={cn(buttonVariants({ variant: "outline" }), page >= pageCount && "pointer-events-none opacity-50")}>Next</Link></nav>;
}

function CustomersLoading() {
  return <main className="min-h-screen animate-pulse bg-slate-50 px-6 py-10"><div className="mx-auto max-w-6xl space-y-6"><div className="h-10 w-40 rounded bg-slate-200" /><div className="h-28 rounded-2xl bg-white" /><div className="grid gap-4 md:grid-cols-3">{[1,2,3].map((value) => <div key={value} className="h-48 rounded-2xl bg-white" />)}</div></div></main>;
}
