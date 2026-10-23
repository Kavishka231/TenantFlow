import type { Metadata } from "next";
import { Building2, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { switchWorkspaceAction } from "@/app/organizations/actions";
import { buttonVariants, Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listOrganizationsForUser } from "@/lib/organizations/list";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Workspaces" };

async function OrganizationList() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const organizations = await listOrganizationsForUser(user.id);

  if (organizations.length === 0) {
    return (
      <Card className="border-dashed py-12 text-center">
        <CardContent className="flex flex-col items-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Building2 aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-xl font-semibold">Create your first workspace</h2>
          <p className="mt-2 max-w-md text-muted-foreground">
            You do not belong to an organization yet. Create one to continue.
          </p>
          <Link href="/organizations/new" className={cn(buttonVariants(), "mt-6")}>
            <Plus aria-hidden="true" /> Create organization
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {organizations.map((organization) => (
        <Card key={organization.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>{organization.name}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">/{organization.slug}</p>
              </div>
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium capitalize text-indigo-700">
                {organization.role}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <form action={switchWorkspaceAction}>
              <input type="hidden" name="organizationId" value={organization.id} />
              <Button type="submit" variant="outline" className="w-full">
                <ShieldCheck aria-hidden="true" /> Open workspace
              </Button>
            </form>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function OrganizationsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-indigo-600">TenantFlow</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Choose a workspace</h1>
            <p className="mt-2 text-muted-foreground">Only organizations you belong to are shown.</p>
          </div>
          <Link href="/organizations/new" className={buttonVariants()}>
            <Plus aria-hidden="true" /> New organization
          </Link>
        </div>
        <Suspense fallback={<OrganizationListSkeleton />}>
          <OrganizationList />
        </Suspense>
      </div>
    </main>
  );
}

function OrganizationListSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2" aria-label="Loading workspaces">
      {[0, 1].map((item) => (
        <div key={item} className="h-40 animate-pulse rounded-xl bg-white shadow-sm" />
      ))}
    </div>
  );
}
