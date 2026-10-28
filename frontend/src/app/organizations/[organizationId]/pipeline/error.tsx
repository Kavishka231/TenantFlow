"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) { return <main className="grid min-h-screen place-items-center bg-slate-50 px-6"><div className="rounded-2xl border bg-white p-8 text-center"><h1 className="text-xl font-semibold">Pipeline could not be loaded</h1><p className="mt-2 text-sm text-muted-foreground">No deal data was changed.</p><Button onClick={reset} className="mt-5">Try again</Button></div></main>; }
