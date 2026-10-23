"use client";

import { useActionState } from "react";

import { updateOrganizationAction } from "@/app/organization-settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialTeamActionState } from "@/lib/team/action-state";

export function OrganizationSettingsForm({
  organizationId,
  name,
}: {
  organizationId: string;
  name: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateOrganizationAction,
    initialTeamActionState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="organizationId" value={organizationId} />
      <div className="space-y-2">
        <Label htmlFor="organization-name">Organization name</Label>
        <Input
          id="organization-name"
          name="name"
          defaultValue={name}
          minLength={2}
          maxLength={120}
          required
        />
      </div>
      {state.message ? (
        <p
          className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-emerald-700"}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
