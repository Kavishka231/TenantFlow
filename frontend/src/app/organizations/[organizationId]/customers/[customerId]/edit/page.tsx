import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { CustomerForm } from "@/components/customers/customer-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCustomerForUser } from "@/lib/customers/get";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Edit customer" };

async function EditCustomerContent({ params }: { params: Promise<{ organizationId: string; customerId: string }> }) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login");
  const { organizationId, customerId } = await params; const organization = await authorize(user.id, organizationId); const customer = await getCustomerForUser(user.id, organization.id, customerId); if (!customer) notFound();
  return <main className="min-h-screen bg-slate-50 px-6 py-10"><div className="mx-auto max-w-3xl space-y-6"><Link href={`/organizations/${organization.id}/customers/${customer.id}`} className={cn(buttonVariants({ variant: "ghost" }), "-ml-3")}><ArrowLeft aria-hidden="true" /> Back to customer</Link><header><p className="text-sm font-medium text-indigo-600">{organization.name}</p><h1 className="mt-1 text-3xl font-semibold">Edit customer</h1></header><Card><CardHeader><CardTitle>Customer details</CardTitle></CardHeader><CardContent><CustomerForm organizationId={organization.id} customer={customer} /></CardContent></Card></div></main>;
}
export default function EditCustomerPage(props: { params: Promise<{ organizationId: string; customerId: string }> }) { return <Suspense fallback={<div className="min-h-screen animate-pulse bg-slate-50" />}><EditCustomerContent {...props} /></Suspense>; }
async function authorize(userId: string, organizationId: string) { try { return await requireOrganizationPermission(userId, organizationId, "manage_customers"); } catch { notFound(); } }
