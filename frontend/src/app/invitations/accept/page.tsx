import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AcceptInvitationForm } from "@/components/team/accept-invitation-form";
import { invitationTokenSchema } from "@/lib/team/validation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Accept invitation",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

async function InvitationContent({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const tokenResult = invitationTokenSchema.safeParse(
    (await searchParams).token,
  );

  if (!tokenResult.success) {
    return <InvitationError />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/invitations/accept?token=${tokenResult.data}`)}`,
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6">
      <section className="w-full max-w-md rounded-3xl border bg-white p-8 shadow-sm">
        <span className="grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
          <MailCheck aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold">Join your team</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The invitation will only be accepted when it matches your verified
          account email.
        </p>
        <AcceptInvitationForm token={tokenResult.data} />
      </section>
    </main>
  );
}

export default function AcceptInvitationPage(props: {
  searchParams: Promise<{ token?: string }>;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen animate-pulse bg-slate-50" />}>
      <InvitationContent {...props} />
    </Suspense>
  );
}

function InvitationError() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6">
      <section className="w-full max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">Invalid invitation link</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask an organization administrator for a new invitation.
        </p>
      </section>
    </main>
  );
}
