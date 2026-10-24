"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button, buttonVariants } from "@/components/ui/button";

export default function CustomerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Customer route failed", error.digest ?? error.name);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6">
      <section className="w-full max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm">
        <AlertCircle className="mx-auto size-10 text-amber-600" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold">Customer data is unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The request could not be completed. No customer changes were confirmed.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button type="button" onClick={reset}>Try again</Button>
          <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>Dashboard</Link>
        </div>
      </section>
    </main>
  );
}
