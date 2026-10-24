import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { deleteCustomerAction } from "@/app/customers/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCustomerForUser } from "@/lib/customers/get";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Delete customer" };

async function DeleteCustomerContent({ params }: { params: Promise<{ organizationId: string; customerId: string }> }) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login");
  const { organizationId, customerId } = await params; const organization = await authorize(user.id, organizationId); const customer = await getCustomerForUser(user.id, organization.id, customerId); if (!customer) notFound();
  return <main className="grid min-h-screen place-items-center bg-slate-50 px-6"><Card className="w-full max-w-lg"><CardHeader><span className="mb-3 grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600"><AlertTriangle aria-hidden="true" /></span><CardTitle>Delete {customer.name}?</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">This permanently removes the customer from {organization.name}. Audit history remains available to workspace managers.</p><form action={deleteCustomerAction} className="mt-6 flex justify-end gap-3"><input type="hidden" name="organizationId" value={organization.id} /><input type="hidden" name="customerId" value={customer.id} /><input type="hidden" name="version" value={customer.version} /><Link href={`/organizations/${organization.id}/customers/${customer.id}`} className={buttonVariants({ variant: "outline" })}>Cancel</Link><Button type="submit" variant="destructive">Delete customer</Button></form></CardContent></Card></main>;
}
export default function DeleteCustomerPage(props: { params: Promise<{ organizationId: string; customerId: string }> }) { return <Suspense fallback={<div className="min-h-screen animate-pulse bg-slate-50" />}><DeleteCustomerContent {...props} /></Suspense>; }
async function authorize(userId: string, organizationId: string) { try { return await requireOrganizationPermission(userId, organizationId, "manage_customers"); } catch { notFound(); } }
