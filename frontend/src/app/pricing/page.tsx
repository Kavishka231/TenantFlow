import type { Metadata } from "next";
import { Check, MoveLeft } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { planCatalog } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return <main className="min-h-screen bg-slate-50 px-6 py-12"><div className="mx-auto max-w-6xl">
    <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "-ml-3")}><MoveLeft /> Home</Link>
    <header className="mx-auto mt-10 max-w-2xl text-center"><p className="text-sm font-medium text-indigo-600">Simple test-mode billing</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">A plan for every workspace</h1><p className="mt-4 text-muted-foreground">Subscriptions are purchased per organization. Prices shown are monthly in USD.</p></header>
    <div className="mt-10 grid gap-5 md:grid-cols-3">{Object.entries(planCatalog).map(([key, plan]) => <Card key={key} className={key === "starter" ? "ring-2 ring-indigo-500" : ""}><CardHeader><CardTitle>{plan.name}</CardTitle><CardDescription>{plan.description}</CardDescription></CardHeader><CardContent><p className="text-3xl font-semibold">${(plan.monthlyPriceMinor / 100).toFixed(0)}<span className="text-sm font-normal text-muted-foreground">/month</span></p><ul className="mt-6 space-y-3">{plan.features.map(feature => <li key={feature} className="flex gap-2 text-sm"><Check className="size-4 text-emerald-600" />{feature}</li>)}</ul><Link href="/register" className={cn(buttonVariants({ variant: key === "starter" ? "default" : "outline" }), "mt-8 w-full")}>Get started</Link></CardContent></Card>)}</div>
  </div></main>;
}
