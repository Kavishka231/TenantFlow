import type { Metadata } from "next";
import { Check, FlaskConical, MoveLeft } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { planCatalog } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 sm:py-12"><div className="mx-auto max-w-6xl">
    <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "-ml-3")}><MoveLeft /> Home</Link>
    <header className="mx-auto mt-8 max-w-2xl text-center sm:mt-10"><p className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900"><FlaskConical className="size-4" aria-hidden="true" />Stripe Test Mode only</p><h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">A plan for every workspace</h1><p className="mt-4 text-pretty text-muted-foreground">Subscriptions are scoped per organization. Portfolio checkout flows use Stripe Test Mode and never create live charges.</p></header>
    <div className="mt-10 grid gap-5 md:grid-cols-3">{Object.entries(planCatalog).map(([key, plan]) => <Card key={key} className={key === "starter" ? "ring-2 ring-indigo-500" : ""}><CardHeader><CardTitle>{plan.name}</CardTitle><CardDescription>{plan.description}</CardDescription></CardHeader><CardContent><p className="text-3xl font-semibold">${(plan.monthlyPriceMinor / 100).toFixed(0)}<span className="text-sm font-normal text-muted-foreground">/month</span></p><ul className="mt-6 space-y-3">{plan.features.map(feature => <li key={feature} className="flex gap-2 text-sm"><Check className="size-4 text-emerald-600" />{feature}</li>)}</ul><Link href="/register" className={cn(buttonVariants({ variant: key === "starter" ? "default" : "outline" }), "mt-8 w-full")}>Get started</Link></CardContent></Card>)}</div>
  </div></main>;
}
