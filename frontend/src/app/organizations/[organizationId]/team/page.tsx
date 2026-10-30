import type { Metadata } from "next";
import { ArrowLeft, Mail, Shield, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { revokeInvitationAction } from "@/app/team/actions";
import { InvitationForm } from "@/components/team/invitation-form";
import { MemberActions } from "@/components/team/member-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listTeamThroughBackend } from "@/lib/backend/team";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import TeamLoading from "./loading";

export const metadata: Metadata = { title: "Team management" };

async function TeamContent({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ teamStatus?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { organizationId } = await params;
  const organization = await authorizeTeamManagement(user.id, organizationId);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const { invitations, members } = await listTeamThroughBackend(
    user.id,
    session?.access_token,
    organization.id,
  );
  const { teamStatus } = await searchParams;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: "ghost" }), "-ml-3")}
        >
          <ArrowLeft aria-hidden="true" /> Back to dashboard
        </Link>

        <header>
          <p className="text-sm font-medium capitalize text-indigo-600">
            {organization.role} access
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {organization.name} team
          </h1>
          <p className="mt-2 text-muted-foreground">
            Manage workspace access and pending invitations.
          </p>
        </header>

        {teamStatus ? (
          <p
            className={`rounded-xl border p-4 text-sm ${teamStatus === "updated" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}
            role={teamStatus === "updated" ? "status" : "alert"}
          >
            {teamStatus === "updated"
              ? "Team membership updated."
              : "That membership change is not permitted."}
          </p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="size-5 text-indigo-600" aria-hidden="true" />
              Invite a teammate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InvitationForm
              organizationId={organization.id}
              canInviteAdmins={organization.role === "owner"}
            />
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5 text-indigo-600" aria-hidden="true" />
                Members ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {members.length ? (
                members.map((member) => (
                  <div
                    key={member.userId}
                    className="rounded-xl border p-4"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100">
                          <UserRound className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {member.fullName ?? "Team member"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Joined {member.joinedAt.toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize">
                        {member.role}
                      </span>
                    </div>
                    <MemberActions
                      actorId={user.id}
                      actorRole={organization.role}
                      member={member}
                      organizationId={organization.id}
                    />
                  </div>
                ))
              ) : (
                <EmptyState icon={Users} message="No members found." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="size-5 text-indigo-600" aria-hidden="true" />
                Pending invitations ({invitations.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {invitations.length ? (
                invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between gap-4 rounded-xl border p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{invitation.email}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {invitation.role} · expires {invitation.expiresAt.toLocaleDateString()}
                      </p>
                    </div>
                    {organization.role === "owner" || invitation.role === "member" ? (
                      <form action={revokeInvitationAction}>
                        <input type="hidden" name="organizationId" value={organization.id} />
                        <input type="hidden" name="invitationId" value={invitation.id} />
                        <Button type="submit" size="sm" variant="outline">
                          Revoke
                        </Button>
                      </form>
                    ) : null}
                  </div>
                ))
              ) : (
                <EmptyState icon={Mail} message="No pending invitations." />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

export default function TeamPage(props: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ teamStatus?: string }>;
}) {
  return (
    <Suspense fallback={<TeamLoading />}>
      <TeamContent {...props} />
    </Suspense>
  );
}

async function authorizeTeamManagement(userId: string, organizationId: string) {
  try {
    return await requireOrganizationPermission(
      userId,
      organizationId,
      "manage_members",
    );
  } catch {
    notFound();
  }
}

function EmptyState({
  icon: Icon,
  message,
}: {
  icon: typeof Users;
  message: string;
}) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      <Icon className="mx-auto mb-3 size-6" aria-hidden="true" />
      {message}
    </div>
  );
}
