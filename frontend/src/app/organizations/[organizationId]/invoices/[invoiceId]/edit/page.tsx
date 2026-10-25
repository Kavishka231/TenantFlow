import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { InvoiceForm } from "@/components/invoices/invoice-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInvoiceForUser } from "@/lib/invoices/get";
import { listInvoiceCustomersForUser } from "@/lib/invoices/list";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata={title:"Edit invoice"};
export default async function Page({params}:{params:Promise<{organizationId:string;invoiceId:string}>}){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");const{organizationId,invoiceId}=await params;let organization;try{organization=await requireOrganizationPermission(user.id,organizationId,"manage_invoices");}catch{notFound();}const[invoice,customers]=await Promise.all([getInvoiceForUser(user.id,organization.id,invoiceId),listInvoiceCustomersForUser(user.id,organization.id)]);if(!invoice||invoice.status!=="draft")notFound();return <main className="min-h-screen bg-slate-50 px-6 py-10"><div className="mx-auto max-w-4xl space-y-6"><Link href={`/organizations/${organization.id}/invoices/${invoice.id}`} className={cn(buttonVariants({variant:"ghost"}),"-ml-3")}><ArrowLeft/> Back to invoice</Link><header><p className="text-sm font-medium text-indigo-600">{invoice.invoiceNumber}</p><h1 className="mt-1 text-3xl font-semibold">Edit draft</h1></header><Card><CardHeader><CardTitle>Invoice details</CardTitle></CardHeader><CardContent><InvoiceForm organizationId={organization.id} customers={customers} invoice={invoice}/></CardContent></Card></div></main>;}
