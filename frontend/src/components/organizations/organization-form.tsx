"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { createOrganizationAction } from "@/app/organizations/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialOrganizationActionState } from "@/lib/organizations/action-state";
import { slugifyOrganizationName } from "@/lib/organizations/validation";

export function OrganizationForm() {
  const [state, formAction, pending] = useActionState(
    createOrganizationAction,
    initialOrganizationActionState,
  );
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  return (
    <Card className="w-full max-w-xl border-slate-200 shadow-xl shadow-slate-200/60">
      <CardHeader>
        <CardTitle className="text-2xl">Create an organization</CardTitle>
        <CardDescription>
          Set up a secure workspace. You will become its owner automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Organization name</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(event) => {
                const nextName = event.target.value;
                setName(nextName);
                if (!slugEdited) {
                  setSlug(slugifyOrganizationName(nextName));
                }
              }}
              autoComplete="organization"
              minLength={2}
              maxLength={120}
              placeholder="Acme Technologies"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Workspace URL</Label>
            <div className="flex items-center rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
              <span className="pl-3 text-sm text-muted-foreground">tenantflow.app/</span>
              <Input
                id="slug"
                name="slug"
                value={slug}
                onChange={(event) => {
                  setSlugEdited(true);
                  setSlug(event.target.value.toLowerCase());
                }}
                className="border-0 pl-0 shadow-none focus-visible:ring-0"
                minLength={2}
                maxLength={63}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                placeholder="acme-technologies"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Use lowercase letters, numbers, and single hyphens.
            </p>
          </div>
          {state.message ? (
            <p className="text-sm text-destructive" role="alert">
              {state.message}
            </p>
          ) : null}
          <Button className="h-10 w-full" type="submit" disabled={pending}>
            {pending ? "Creating workspace…" : "Create workspace"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        <Link href="/organizations" className="underline-offset-4 hover:underline">
          Back to workspaces
        </Link>
      </CardFooter>
    </Card>
  );
}
