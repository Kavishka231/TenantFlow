import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { deleteDealAction } from "@/app/deals/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDealForUser } from "@/lib/deals/data";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function DeleteDealPage({ params }: { params: Promise<{ organizationId: string; dealId: string }> }) { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login"); const { organizationId, dealId } = await params; let organization; try { organization = await requireOrganizationPermission(user.id, organizationId, "manage_deals"); } catch { notFound(); } const deal = await getDealForUser(user.id, organization.id, dealId); if (!deal) notFound(); return <main className="grid min-h-screen place-items-center bg-slate-50 px-6"><Card className="w-full max-w-lg"><CardHeader><CardTitle>Delete {deal.title}?</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">This permanently removes the deal and its activity history.</p><form action={deleteDealAction} className="mt-6 flex justify-end gap-3"><input type="hidden" name="organizationId" value={organization.id} /><input type="hidden" name="dealId" value={deal.id} /><input type="hidden" name="version" value={deal.version} /><Link href={`/organizations/${organization.id}/deals/${deal.id}`} className={cn(buttonVariants({ variant: "outline" }))}><ArrowLeft /> Cancel</Link><Button type="submit" variant="destructive"><Trash2 /> Delete deal</Button></form></CardContent></Card></main>; }
