import type { Metadata } from "next";
import { Building2, LogOut, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { logoutAction } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

async function DashboardContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="rounded-3xl border bg-white p-8 shadow-sm">
        <div className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
          <ShieldCheck className="size-6" aria-hidden="true" />
        </div>
        <p className="mt-6 text-sm font-medium text-indigo-600">Authenticated session</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your secure workspace foundation is ready.</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Signed in as <span className="font-medium text-slate-900">{user.email}</span>. Organization onboarding and workspace features are intentionally reserved for the next milestone.
        </p>
      </div>
    </section>
  );
}

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3 font-semibold">
            <span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white">
              <Building2 className="size-5" aria-hidden="true" />
            </span>
            TenantFlow
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="outline">
              <LogOut className="size-4" aria-hidden="true" /> Log out
            </Button>
          </form>
        </div>
      </header>
      <Suspense fallback={<div className="mx-auto mt-12 h-56 max-w-6xl animate-pulse rounded-3xl bg-white" />}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}
