import { ArrowLeft, LayoutDashboard, ShieldQuestion } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-12 sm:px-6">
      <section className="w-full max-w-lg rounded-3xl border bg-white p-8 text-center shadow-sm sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-700">
          <ShieldQuestion className="size-7" aria-hidden="true" />
        </span>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">404 · Safe boundary</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">This page is unavailable</h1>
        <p className="mx-auto mt-3 max-w-md text-pretty leading-7 text-muted-foreground">
          The resource may not exist, or your current workspace role may not have permission to view it.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/dashboard" className={buttonVariants()}>
            <LayoutDashboard aria-hidden="true" /> Dashboard
          </Link>
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
            <ArrowLeft aria-hidden="true" /> Public home
          </Link>
        </div>
      </section>
    </main>
  );
}
