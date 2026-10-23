"use client";

import { useActionState } from "react";

import { createInvitationAction } from "@/app/team/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialTeamActionState } from "@/lib/team/action-state";

export function InvitationForm({
  organizationId,
  canInviteAdmins,
}: {
  organizationId: string;
  canInviteAdmins: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    createInvitationAction,
    initialTeamActionState,
  );

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-[1fr_10rem_auto] md:items-end">
      <input type="hidden" name="organizationId" value={organizationId} />
      <div className="space-y-2">
        <Label htmlFor="invitation-email">Email address</Label>
        <Input
          id="invitation-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="teammate@example.com"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="invitation-role">Role</Label>
        <select
          id="invitation-role"
          name="role"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          defaultValue="member"
        >
          <option value="member">Member</option>
          {canInviteAdmins ? <option value="admin">Admin</option> : null}
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send invitation"}
      </Button>
      {state.message ? (
        <p
          className={`text-sm md:col-span-3 ${state.status === "error" ? "text-destructive" : "text-emerald-700"}`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
