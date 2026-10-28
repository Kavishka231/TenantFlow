import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PipelineBoard } from "@/components/deals/pipeline-board";
import { buttonVariants } from "@/components/ui/button";
import { listPipelineForUser } from "@/lib/deals/data";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function PipelinePage({ params, searchParams }: { params: Promise<{ organizationId: string }>; searchParams: Promise<{ deleted?: string }> }) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login"); const { organizationId } = await params;
  let organization; try { organization = await requireOrganizationPermission(user.id, organizationId, "read_deals"); } catch { notFound(); }
  const [pipeline, query] = await Promise.all([listPipelineForUser(user.id, organization.id), searchParams]); const canManage = organization.role !== "member";
  return <main className="min-h-screen bg-slate-50 px-6 py-10"><div className="mx-auto max-w-[96rem] space-y-6"><Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost" }), "-ml-3")}><ArrowLeft /> Dashboard</Link><div className="flex flex-wrap items-end justify-between gap-4"><header><p className="text-sm font-medium text-indigo-600">{organization.name}</p><h1 className="mt-1 text-3xl font-semibold">Sales pipeline</h1><p className="mt-2 text-muted-foreground">{canManage ? "Drag deals between stages to update progress." : "Read-only pipeline access."}</p></header>{canManage ? <Link href={`/organizations/${organization.id}/pipeline/new`} className={buttonVariants()}><Plus /> New deal</Link> : null}</div>{query.deleted ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Deal deleted.</p> : null}<PipelineBoard organizationId={organization.id} stages={pipeline.stages} deals={pipeline.deals} canManage={canManage} /></div></main>;
}
