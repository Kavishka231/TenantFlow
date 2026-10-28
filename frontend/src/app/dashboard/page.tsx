import type { Metadata } from "next";
import { Building2, LogOut, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { logoutAction } from "@/app/dashboard/actions";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { WorkspaceSwitcher } from "@/components/organizations/workspace-switcher";
import { Button, buttonVariants } from "@/components/ui/button";
import { getMonthlyFinancialAnalyticsForUser } from "@/lib/analytics/financial";
import { getDashboardInsightsForUser } from "@/lib/analytics/insights";
import { getDashboardMetricsForUser } from "@/lib/analytics/metrics";
import { resolveAnalyticsRange } from "@/lib/analytics/range";
import { getSalesMetricsForUser } from "@/lib/deals/metrics";
import type { OrganizationSummary } from "@/lib/organizations/list";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { getActiveWorkspaceForUser } from "@/lib/organizations/workspace";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };
type SearchParams = { workspaceError?: string; preset?: string; start?: string; end?: string };

async function DashboardContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ activeOrganization, organizations }, query] = await Promise.all([getActiveWorkspaceForUser(user.id), searchParams]);
  const range = resolveAnalyticsRange(query);

  return <main className="min-h-screen bg-slate-50"><header className="border-b bg-white"><div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3"><Link href="/dashboard" className="flex items-center gap-3 font-semibold"><span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white"><Building2 className="size-5" /></span>TenantFlow</Link><div className="flex flex-wrap items-center gap-2">{activeOrganization ? <WorkspaceSwitcher activeOrganization={activeOrganization} organizations={organizations} /> : null}<form action={logoutAction}><Button type="submit" variant="outline"><LogOut /> Log out</Button></form></div></div></header><section className="mx-auto max-w-7xl px-6 py-10">{query.workspaceError ? <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">That workspace could not be selected. Your authorized workspace is unchanged.</div> : null}{activeOrganization ? <WorkspaceAnalytics userId={user.id} organization={activeOrganization} range={range} /> : <EmptyWorkspace />}</section></main>;
}

async function WorkspaceAnalytics({ userId, organization, range }: { userId: string; organization: OrganizationSummary; range: ReturnType<typeof resolveAnalyticsRange> }) {
  await requireOrganizationPermission(userId, organization.id, "read_analytics");
  const [metrics, financial, insights, sales] = await Promise.all([
    getDashboardMetricsForUser(userId, organization.id, range),
    getMonthlyFinancialAnalyticsForUser(userId, organization.id, range),
    getDashboardInsightsForUser(userId, organization.id, range),
    getSalesMetricsForUser(userId, organization.id, range),
  ]);
  return <AnalyticsDashboard organization={organization} range={range} metrics={metrics} financial={financial} insights={insights} sales={sales} />;
}

function EmptyWorkspace() {
  return <div className="rounded-3xl border border-dashed bg-white p-10 text-center"><Building2 className="mx-auto size-10 text-indigo-600" /><h1 className="mt-5 text-2xl font-semibold">No workspace yet</h1><p className="mx-auto mt-2 max-w-md text-muted-foreground">Create an organization to establish your first tenant workspace.</p><Link href="/organizations/new" className={cn(buttonVariants(), "mt-6")}><Plus /> Create organization</Link></div>;
}

export default function DashboardPage(props: { searchParams: Promise<SearchParams> }) {
  return <Suspense fallback={<DashboardSkeleton />}><DashboardContent {...props} /></Suspense>;
}

function DashboardSkeleton() {
  return <main className="min-h-screen animate-pulse bg-slate-50"><div className="h-16 border-b bg-white" /><div className="mx-auto grid max-w-7xl gap-5 px-6 py-10 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-36 rounded-xl bg-white" />)}</div></main>;
}
