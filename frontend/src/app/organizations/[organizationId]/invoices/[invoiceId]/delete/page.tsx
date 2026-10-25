import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { deleteInvoiceAction } from "@/app/invoices/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInvoiceForUser } from "@/lib/invoices/get";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function Page({params}:{params:Promise<{organizationId:string;invoiceId:string}>}){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");const{organizationId,invoiceId}=await params;let organization;try{organization=await requireOrganizationPermission(user.id,organizationId,"manage_invoices");}catch{notFound();}const invoice=await getInvoiceForUser(user.id,organization.id,invoiceId);if(!invoice||invoice.status!=="draft")notFound();return <main className="min-h-screen bg-slate-50 px-6 py-10"><div className="mx-auto max-w-xl space-y-6"><Link href={`/organizations/${organization.id}/invoices/${invoice.id}`} className={cn(buttonVariants({variant:"ghost"}),"-ml-3")}><ArrowLeft/> Back to invoice</Link><Card><CardHeader><CardTitle>Delete {invoice.invoiceNumber}?</CardTitle></CardHeader><CardContent className="space-y-5"><p className="text-sm text-muted-foreground">This permanently removes the draft and its line items. Sent invoices and payment records cannot be deleted.</p><form action={deleteInvoiceAction}><input type="hidden" name="organizationId" value={organization.id}/><input type="hidden" name="invoiceId" value={invoice.id}/><input type="hidden" name="version" value={invoice.version}/><Button type="submit" variant="destructive"><Trash2/> Delete draft</Button></form></CardContent></Card></div></main>;}
