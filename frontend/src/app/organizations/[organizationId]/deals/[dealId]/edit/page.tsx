import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { DealForm } from "@/components/deals/deal-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDealForUser, getDealFormOptions } from "@/lib/deals/data";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

async function EditDealContent({ params }: { params: Promise<{ organizationId: string; dealId: string }> }) { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login"); const { organizationId, dealId } = await params; let organization; try { organization = await requireOrganizationPermission(user.id, organizationId, "manage_deals"); } catch { notFound(); } const [deal, options] = await Promise.all([getDealForUser(user.id, organization.id, dealId), getDealFormOptions(user.id, organization.id)]); if (!deal) notFound(); return <main className="min-h-screen bg-slate-50 px-6 py-10"><div className="mx-auto max-w-3xl"><Link href={`/organizations/${organization.id}/deals/${deal.id}`} className={cn(buttonVariants({ variant: "ghost" }), "-ml-3")}><ArrowLeft /> Deal</Link><Card className="mt-6"><CardHeader><CardTitle>Edit deal</CardTitle></CardHeader><CardContent><DealForm organizationId={organization.id} options={options} deal={deal} /></CardContent></Card></div></main>; }
export default function EditDealPage(props: { params: Promise<{ organizationId: string; dealId: string }> }) { return <Suspense fallback={<div className="min-h-screen animate-pulse bg-slate-50" />}><EditDealContent {...props} /></Suspense>; }
