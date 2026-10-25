import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { InvoiceForm } from "@/components/invoices/invoice-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listInvoiceCustomersForUser } from "@/lib/invoices/list";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "New invoice" };
export default async function Page({ params }: { params: Promise<{ organizationId: string }> }) { const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");const{organizationId}=await params;let organization;try{organization=await requireOrganizationPermission(user.id,organizationId,"manage_invoices");}catch{notFound();}const customers=await listInvoiceCustomersForUser(user.id,organization.id);return <main className="min-h-screen bg-slate-50 px-6 py-10"><div className="mx-auto max-w-4xl space-y-6"><Link href={`/organizations/${organization.id}/invoices`} className={cn(buttonVariants({variant:"ghost"}),"-ml-3")}><ArrowLeft/> Back to invoices</Link><header><p className="text-sm font-medium text-indigo-600">{organization.name}</p><h1 className="mt-1 text-3xl font-semibold">New invoice</h1></header>{customers.length ? <Card><CardHeader><CardTitle>Draft details</CardTitle></CardHeader><CardContent><InvoiceForm organizationId={organization.id} customers={customers}/></CardContent></Card> : <Card><CardContent className="py-10 text-center"><p className="font-medium">Create a customer first</p><p className="mt-2 text-sm text-muted-foreground">Every invoice must belong to a customer in this workspace.</p><Link href={`/organizations/${organization.id}/customers/new`} className={cn(buttonVariants(),"mt-5")}>New customer</Link></CardContent></Card>}</div></main>;}
