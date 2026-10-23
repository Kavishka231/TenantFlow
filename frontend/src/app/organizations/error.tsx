"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function OrganizationsError({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6">
      <div className="max-w-md text-center">
        <AlertTriangle className="mx-auto size-10 text-amber-500" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold">Workspaces are unavailable</h1>
        <p className="mt-2 text-muted-foreground">
          We could not load your organizations. No workspace selection was changed.
        </p>
        <Button className="mt-6" onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
