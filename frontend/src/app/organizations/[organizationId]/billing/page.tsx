import type { Metadata } from "next";
import { ArrowLeft, Check, CreditCard, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createCheckoutAction, createPortalAction } from "@/app/billing/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBillingForUser, listActivePlansForUser } from "@/lib/billing/data";
import { isStripeConfigured } from "@/lib/billing/env";
import { subscriptionNotice, subscriptionStatusLabels } from "@/lib/billing/lifecycle";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage({ params, searchParams }: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ checkout?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { organizationId } = await params;
  let organization;
  try { organization = await requireOrganizationPermission(user.id, organizationId, "manage_billing"); } catch { notFound(); }
  const [plans, billing, query] = await Promise.all([
    listActivePlansForUser(user.id), getBillingForUser(user.id, organization.id), searchParams,
  ]);
  const stripeReady = isStripeConfigured();
  return <main className="min-h-screen bg-slate-50 px-6 py-10"><div className="mx-auto max-w-5xl space-y-6">
    <Link href="/dashboard" className={cn(buttonVariants({ variant: "ghost" }), "-ml-3")}><ArrowLeft /> Dashboard</Link>
    <header><p className="text-sm font-medium text-indigo-600">{organization.name}</p><h1 className="mt-1 text-3xl font-semibold">Subscription billing</h1><p className="mt-2 text-muted-foreground">Owner-only TenantFlow plan management, securely hosted by Stripe.</p></header>
    {query.checkout === "success" ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Checkout completed. Stripe is synchronizing your subscription.</p> : null}
    {query.checkout === "cancelled" ? <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Checkout was cancelled; no local subscription was activated.</p> : null}
    {!stripeReady ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Stripe Test Mode is not configured. Add the server-only Stripe keys and test Price IDs to enable checkout.</p> : null}
    {billing.subscription ? <Card><CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="size-5 text-indigo-600" />{billing.subscription.planName}</CardTitle><CardDescription><span className="capitalize">{subscriptionStatusLabels[billing.subscription.status]}</span> · {subscriptionNotice(billing.subscription)}</CardDescription></CardHeader><CardContent>{stripeReady && billing.customer ? <form action={createPortalAction}><input type="hidden" name="organizationId" value={organization.id} /><Button type="submit">Manage in Stripe <ExternalLink /></Button></form> : null}</CardContent></Card> : null}
    <section aria-labelledby="plans-heading"><h2 id="plans-heading" className="text-xl font-semibold">Plans</h2><div className="mt-4 grid gap-4 md:grid-cols-3">{plans.map(plan => <Card key={plan.id} className={billing.subscription?.planKey === plan.key ? "ring-2 ring-indigo-500" : ""}><CardHeader><CardTitle>{plan.name}</CardTitle><CardDescription>{plan.description}</CardDescription></CardHeader><CardContent><p className="text-2xl font-semibold">${(plan.monthlyPriceMinor / 100).toFixed(0)}<span className="text-sm font-normal text-muted-foreground">/mo</span></p><ul className="mt-4 space-y-2">{plan.features.map(feature => <li key={feature} className="flex gap-2 text-sm"><Check className="size-4 text-emerald-600" />{feature}</li>)}</ul>{plan.key !== "free" && !billing.subscription ? <form action={createCheckoutAction} className="mt-6"><input type="hidden" name="organizationId" value={organization.id} /><input type="hidden" name="planKey" value={plan.key} /><Button type="submit" disabled={!stripeReady} className="w-full">Choose {plan.name}</Button></form> : null}{billing.subscription?.planKey === plan.key ? <p className="mt-6 text-sm font-medium text-indigo-600">Current plan</p> : null}</CardContent></Card>)}</div></section>
  </div></main>;
}
