import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { OrganizationForm } from "@/components/organizations/organization-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Create organization" };

async function NewOrganizationContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <OrganizationForm />;
}

export default function NewOrganizationPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6 py-12">
      <div className="flex w-full flex-col items-center gap-8">
        <Link href="/dashboard" className="flex items-center gap-3 font-semibold tracking-tight">
          <span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          TenantFlow
        </Link>
        <Suspense fallback={<div className="h-96 w-full max-w-xl animate-pulse rounded-xl bg-white" />}>
          <NewOrganizationContent />
        </Suspense>
      </div>
    </main>
  );
}
