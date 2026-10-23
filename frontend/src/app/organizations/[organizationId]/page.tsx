import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Workspace access" };

async function AuthorizedWorkspace({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { organizationId } = await params;
  const organization = await authorizeWorkspace(user.id, organizationId);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6">
      <div className="max-w-xl rounded-3xl border bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-indigo-600">Authorized workspace</p>
        <h1 className="mt-2 text-3xl font-semibold">{organization.name}</h1>
        <p className="mt-3 text-muted-foreground">
          Your {organization.role} membership grants access to this organization.
        </p>
      </div>
    </main>
  );
}

async function authorizeWorkspace(userId: string, organizationId: string) {
  try {
    return await requireOrganizationPermission(
      userId,
      organizationId,
      "read_workspace",
    );
  } catch {
    notFound();
  }
}

export default function WorkspaceAccessPage(props: {
  params: Promise<{ organizationId: string }>;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen animate-pulse bg-slate-50" />}>
      <AuthorizedWorkspace {...props} />
    </Suspense>
  );
}
