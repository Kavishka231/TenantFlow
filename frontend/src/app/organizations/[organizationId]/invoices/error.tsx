"use client";

import { Button } from "@/components/ui/button";

export default function InvoiceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-slate-50 px-6"><div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-semibold">Invoices could not be loaded</h1><p className="mt-2 text-sm text-muted-foreground">Try the request again. If the problem continues, verify the database connection.</p><Button className="mt-5" onClick={reset}>Try again</Button></div></main>;
}
