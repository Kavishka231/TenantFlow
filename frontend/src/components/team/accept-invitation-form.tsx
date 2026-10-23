"use client";

import { useActionState } from "react";

import { acceptInvitationAction } from "@/app/invitations/actions";
import { Button } from "@/components/ui/button";
import {
  initialTeamActionState,
} from "@/lib/team/action-state";

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    acceptInvitationAction,
    initialTeamActionState,
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.message ? (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Accepting invitation…" : "Accept invitation"}
      </Button>
    </form>
  );
}
