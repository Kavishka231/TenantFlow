import type { Metadata } from "next";
import { ArrowLeft, History, Settings } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { OrganizationSettingsForm } from "@/components/organizations/settings-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";
import { listAuditEventsForUser } from "@/lib/team/audit";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Organization settings" };

const eventLabels = {
  invitation_created: "Invitation created",
  invitation_revoked: "Invitation revoked",
  invitation_accepted: "Invitation accepted",
  member_role_changed: "Member role changed",
  member_removed: "Member removed",
  ownership_transferred: "Ownership transferred",
  organization_updated: "Organization updated",
} as const;

export default async function OrganizationSettingsPage({
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
  const organization = await authorizeSettings(user.id, organizationId);
  const events = await listAuditEventsForUser(user.id, organization.id);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost" }), "-ml-3")}>
          <ArrowLeft aria-hidden="true" /> Back to dashboard
        </Link>
        <header>
          <p className="text-sm font-medium capitalize text-indigo-600">
            {organization.role} access
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Organization settings
          </h1>
          <p className="mt-2 text-muted-foreground">/{organization.slug}</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="size-5 text-indigo-600" aria-hidden="true" />
                General
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OrganizationSettingsForm
                organizationId={organization.id}
                name={organization.name}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-5 text-indigo-600" aria-hidden="true" />
                Audit log
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {events.length ? (
                events.map((event) => (
                  <article key={event.id} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-sm font-medium">
                          {eventLabels[event.eventType]}
                        </h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Actor {event.actorId.slice(0, 8)}…
                        </p>
                      </div>
                      <time className="text-xs text-muted-foreground" dateTime={event.createdAt.toISOString()}>
                        {event.createdAt.toLocaleString()}
                      </time>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Audit events will appear after team or settings changes.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

async function authorizeSettings(userId: string, organizationId: string) {
  try {
    return await requireOrganizationPermission(
      userId,
      organizationId,
      "update_organization",
    );
  } catch {
    notFound();
  }
}
