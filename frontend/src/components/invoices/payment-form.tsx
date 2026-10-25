"use client";

import { useActionState } from "react";

import { recordPaymentAction } from "@/app/invoices/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialInvoiceActionState } from "@/lib/invoices/action-state";

export function PaymentForm({ idempotencyKey, invoiceId, organizationId, outstandingMinor }: { idempotencyKey: string; invoiceId: string; organizationId: string; outstandingMinor: number }) {
  const [state, formAction, pending] = useActionState(recordPaymentAction, initialInvoiceActionState);
  return <form action={formAction} className="grid gap-4 md:grid-cols-2">
    <input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="invoiceId" value={invoiceId} /><input type="hidden" name="idempotencyKey" value={idempotencyKey} />
    <div className="space-y-2"><Label htmlFor="payment-amount">Amount</Label><Input id="payment-amount" name="amount" inputMode="decimal" pattern="\d+(\.\d{1,2})?" max={(outstandingMinor / 100).toFixed(2)} required /></div>
    <div className="space-y-2"><Label htmlFor="payment-date">Payment date</Label><Input id="payment-date" name="paymentDate" type="date" max={new Date().toISOString().slice(0, 10)} defaultValue={new Date().toISOString().slice(0, 10)} required /></div>
    <div className="space-y-2"><Label htmlFor="payment-method">Method</Label><select id="payment-method" name="method" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="card">Card</option><option value="check">Check</option><option value="other">Other</option></select></div>
    <div className="space-y-2"><Label htmlFor="payment-reference">Reference</Label><Input id="payment-reference" name="reference" maxLength={160} /></div>
    <div className="space-y-2 md:col-span-2"><Label htmlFor="payment-notes">Notes</Label><textarea id="payment-notes" name="notes" maxLength={2000} rows={2} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" /></div>
    {state.message ? <p role="alert" className="text-sm text-destructive md:col-span-2">{state.message}</p> : null}
    <div className="md:col-span-2"><Button type="submit" disabled={pending}>{pending ? "Recording…" : "Record payment"}</Button></div>
  </form>;
}
