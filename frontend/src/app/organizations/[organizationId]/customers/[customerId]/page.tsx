import type { Metadata } from "next";
import { ArrowLeft, Building2, Mail, MapPin, Pencil, Phone, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { CustomerStatusBadge } from "@/components/customers/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCustomerForUser } from "@/lib/customers/get";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Customer details" };

async function CustomerContent({ params, searchParams }: { params: Promise<{ organizationId: string; customerId: string }>; searchParams: Promise<{ created?: string; updated?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { organizationId, customerId } = await params;
  const organization = await authorize(user.id, organizationId);
  const customer = await getCustomerForUser(user.id, organization.id, customerId);
  if (!customer) notFound();
  const notice = await searchParams;
  const canManage = organization.role !== "member";

  return <main className="min-h-screen bg-slate-50 px-6 py-10"><div className="mx-auto max-w-4xl space-y-6"><Link href={`/organizations/${organization.id}/customers`} className={cn(buttonVariants({ variant: "ghost" }), "-ml-3")}><ArrowLeft aria-hidden="true" /> Back to customers</Link>{notice.created || notice.updated ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Customer {notice.created ? "created" : "updated"} successfully.</p> : null}<div className="flex flex-wrap items-start justify-between gap-4"><header><div className="flex items-center gap-3"><h1 className="text-3xl font-semibold tracking-tight">{customer.name}</h1><CustomerStatusBadge status={customer.status} /></div><p className="mt-2 text-muted-foreground">{customer.company ?? organization.name}</p></header>{canManage ? <div className="flex gap-2"><Link href={`/organizations/${organization.id}/customers/${customer.id}/edit`} className={buttonVariants({ variant: "outline" })}><Pencil aria-hidden="true" /> Edit</Link><Link href={`/organizations/${organization.id}/customers/${customer.id}/delete`} className={buttonVariants({ variant: "destructive" })}><Trash2 aria-hidden="true" /> Delete</Link></div> : null}</div><div className="grid gap-6 md:grid-cols-2"><Card><CardHeader><CardTitle>Contact</CardTitle></CardHeader><CardContent className="space-y-4"><Detail icon={Mail} label="Email" value={customer.email} href={customer.email ? `mailto:${customer.email}` : undefined} /><Detail icon={Phone} label="Phone" value={customer.phone} href={customer.phone ? `tel:${customer.phone}` : undefined} /><Detail icon={Building2} label="Company" value={customer.company} /><Detail icon={MapPin} label="Address" value={customer.address} /></CardContent></Card><Card><CardHeader><CardTitle>Notes</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{customer.notes ?? "No notes have been added."}</p></CardContent></Card></div><p className="text-xs text-muted-foreground">Created {customer.createdAt.toLocaleString()} · Updated {customer.updatedAt.toLocaleString()}</p></div></main>;
}

export default function CustomerPage(props: { params: Promise<{ organizationId: string; customerId: string }>; searchParams: Promise<{ created?: string; updated?: string }> }) { return <Suspense fallback={<div className="min-h-screen animate-pulse bg-slate-50" />}><CustomerContent {...props} /></Suspense>; }

async function authorize(userId: string, organizationId: string) { try { return await requireOrganizationPermission(userId, organizationId, "read_customers"); } catch { notFound(); } }

function Detail({ href, icon: Icon, label, value }: { href?: string; icon: typeof Mail; label: string; value: string | null }) { const content = value ?? "Not provided"; return <div className="flex gap-3"><Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><div className="min-w-0"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>{href ? <a href={href} className="mt-1 block break-words text-sm text-indigo-700 hover:underline">{content}</a> : <p className="mt-1 whitespace-pre-wrap break-words text-sm">{content}</p>}</div></div>; }
