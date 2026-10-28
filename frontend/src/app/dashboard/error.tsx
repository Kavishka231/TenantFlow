"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-slate-50 px-6"><div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm"><AlertTriangle className="mx-auto size-10 text-amber-600" /><h1 className="mt-4 text-xl font-semibold">Analytics could not be loaded</h1><p className="mt-2 text-sm text-muted-foreground">Your workspace data was not changed. Try loading the dashboard again.</p><Button type="button" onClick={reset} className="mt-6">Try again</Button></div></main>;
}
