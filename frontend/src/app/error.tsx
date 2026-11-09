"use client";

import { AlertTriangle, Home } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button, buttonVariants } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application route failed", error.digest ?? error.name);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-12 sm:px-6">
      <section className="w-full max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm">
        <AlertTriangle className="mx-auto size-11 text-amber-600" aria-hidden="true" />
        <h1 className="mt-5 text-2xl font-semibold">TenantFlow could not load this page</h1>
        <p className="mt-3 text-pretty text-sm leading-6 text-muted-foreground">
          No change has been confirmed. Retry the request, or return home if the problem continues.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button type="button" onClick={reset}>Try again</Button>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            <Home aria-hidden="true" /> Home
          </Link>
        </div>
      </section>
    </main>
  );
}
