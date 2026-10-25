import type { Metadata } from "next";
import { Building2, ContactRound, FileText, LogOut, Plus, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { logoutAction } from "@/app/dashboard/actions";
import { WorkspaceSwitcher } from "@/components/organizations/workspace-switcher";
import { buttonVariants, Button } from "@/components/ui/button";
import { getActiveWorkspaceForUser } from "@/lib/organizations/workspace";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

async function DashboardContent({
  searchParams,
}: {
  searchParams: Promise<{ workspaceError?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ activeOrganization, organizations }, query] = await Promise.all([
    getActiveWorkspaceForUser(user.id),
    searchParams,
  ]);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <Link href="/dashboard" className="flex items-center gap-3 font-semibold">
            <span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white">
              <Building2 className="size-5" aria-hidden="true" />
            </span>
            TenantFlow
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {activeOrganization ? (
              <WorkspaceSwitcher
                activeOrganization={activeOrganization}
                organizations={organizations}
              />
            ) : null}
            <form action={logoutAction}>
              <Button type="submit" variant="outline">
                <LogOut aria-hidden="true" /> Log out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        {query.workspaceError ? (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
            That workspace could not be selected. Your authorized workspace is unchanged.
          </div>
        ) : null}

        {activeOrganization ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium capitalize text-indigo-600">
                  {activeOrganization.role} workspace
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                  {activeOrganization.name}
                </h1>
                <p className="mt-2 text-muted-foreground">/{activeOrganization.slug}</p>
              </div>
              <Link href="/organizations" className={buttonVariants({ variant: "outline" })}>
                Manage workspaces
              </Link>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <article className="rounded-2xl border bg-white p-6 shadow-sm">
                <ContactRound className="size-6 text-indigo-600" aria-hidden="true" />
                <h2 className="mt-4 font-semibold">Customer management</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  View tenant-isolated customer records for this workspace.
                </p>
                <Link
                  href={`/organizations/${activeOrganization.id}/customers`}
                  className={cn(buttonVariants({ size: "sm" }), "mt-4")}
                >
                  Open customers
                </Link>
              </article>
              <article className="rounded-2xl border bg-white p-6 shadow-sm">
                <FileText className="size-6 text-indigo-600" aria-hidden="true" />
                <h2 className="mt-4 font-semibold">Invoice management</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Create invoices, track balances, and record manual payments securely.
                </p>
                <Link href={`/organizations/${activeOrganization.id}/invoices`} className={cn(buttonVariants({ size: "sm" }), "mt-4")}>Open invoices</Link>
              </article>
              <article className="rounded-2xl border bg-white p-6 shadow-sm">
                <ShieldCheck className="size-6 text-emerald-600" aria-hidden="true" />
                <h2 className="mt-4 font-semibold">Tenant boundary active</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  This workspace was resolved from your verified membership, not from client input.
                </p>
                {activeOrganization.role !== "member" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/organizations/${activeOrganization.id}/team`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Manage team
                    </Link>
                    <Link
                      href={`/organizations/${activeOrganization.id}/settings`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Settings
                    </Link>
                  </div>
                ) : null}
              </article>
              <article className="rounded-2xl border bg-white p-6 shadow-sm">
                <Users className="size-6 text-indigo-600" aria-hidden="true" />
                <h2 className="mt-4 font-semibold">Your access level</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  You are a <span className="font-medium capitalize text-foreground">{activeOrganization.role}</span>. Role-specific operations are enforced on the server.
                </p>
              </article>
            </div>
          </>
        ) : (
          <div className="rounded-3xl border border-dashed bg-white p-10 text-center">
            <Building2 className="mx-auto size-10 text-indigo-600" aria-hidden="true" />
            <h1 className="mt-5 text-2xl font-semibold">No workspace yet</h1>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              Create an organization to establish your first tenant workspace.
            </p>
            <Link href="/organizations/new" className={cn(buttonVariants(), "mt-6")}>
              <Plus aria-hidden="true" /> Create organization
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

export default function DashboardPage(props: {
  searchParams: Promise<{ workspaceError?: string }>;
}) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent {...props} />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <main className="min-h-screen animate-pulse bg-slate-50">
      <div className="h-16 border-b bg-white" />
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="h-36 rounded-3xl bg-white" />
      </div>
    </main>
  );
}
