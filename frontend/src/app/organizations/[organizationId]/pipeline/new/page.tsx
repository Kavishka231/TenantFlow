import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { DealForm } from "@/components/deals/deal-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDealOptionsThroughBackend } from "@/lib/backend/deals";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

async function NewDealContent({ params }: { params: Promise<{ organizationId: string }> }) { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login"); const { organizationId } = await params; let organization; try { organization = await requireOrganizationPermission(user.id, organizationId, "manage_deals"); } catch { notFound(); } const { data: { session } } = await supabase.auth.getSession(); const options = await getDealOptionsThroughBackend(user.id, session?.access_token, organization.id); return <main className="min-h-screen bg-slate-50 px-6 py-10"><div className="mx-auto max-w-3xl"><Link href={`/organizations/${organization.id}/pipeline`} className={cn(buttonVariants({ variant: "ghost" }), "-ml-3")}><ArrowLeft /> Pipeline</Link><Card className="mt-6"><CardHeader><CardTitle>Create deal</CardTitle></CardHeader><CardContent>{options.customers.length ? <DealForm organizationId={organization.id} options={options} /> : <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Create a customer before adding a deal.</p>}</CardContent></Card></div></main>; }
export default function NewDealPage(props: { params: Promise<{ organizationId: string }> }) { return <Suspense fallback={<div className="min-h-screen animate-pulse bg-slate-50" />}><NewDealContent {...props} /></Suspense>; }
