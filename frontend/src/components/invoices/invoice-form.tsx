"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { createInvoiceAction, updateInvoiceAction } from "@/app/invoices/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialInvoiceActionState } from "@/lib/invoices/action-state";
import { cn } from "@/lib/utils";

type CustomerOption = { company: string | null; id: string; name: string };
type EditableInvoice = {
  currency: string;
  customerId: string;
  discountMinor: number;
  dueDate: string;
  id: string;
  issueDate: string;
  items: { description: string; id: string; quantity: number; unitPriceMinor: number }[];
  notes: string | null;
  taxRateBps: number;
  version: number;
};

export function InvoiceForm({ customers, invoice, organizationId }: { customers: CustomerOption[]; invoice?: EditableInvoice; organizationId: string }) {
  const [items, setItems] = useState(invoice?.items.map((item) => ({ ...item, key: item.id })) ?? [{ description: "", key: "new-item-1", quantity: 1, unitPriceMinor: 0 }]);
  const [state, formAction, pending] = useActionState(invoice ? updateInvoiceAction : createInvoiceAction, initialInvoiceActionState);
  const today = new Date().toISOString().slice(0, 10);
  const cancelHref = invoice ? `/organizations/${organizationId}/invoices/${invoice.id}` : `/organizations/${organizationId}/invoices`;

  return <form action={formAction} className="space-y-7">
    <input type="hidden" name="organizationId" value={organizationId} />
    {invoice ? <><input type="hidden" name="invoiceId" value={invoice.id} /><input type="hidden" name="version" value={invoice.version} /></> : null}
    <div className="grid gap-5 md:grid-cols-2">
      <Field label="Customer" htmlFor="customerId" className="md:col-span-2">
        <select id="customerId" name="customerId" defaultValue={invoice?.customerId ?? ""} required className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="" disabled>Select a customer</option>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.company ? ` — ${customer.company}` : ""}</option>)}
        </select>
      </Field>
      <Field label="Issue date" htmlFor="issueDate"><Input id="issueDate" name="issueDate" type="date" defaultValue={invoice?.issueDate ?? today} required /></Field>
      <Field label="Due date" htmlFor="dueDate"><Input id="dueDate" name="dueDate" type="date" defaultValue={invoice?.dueDate ?? today} required /></Field>
      <Field label="Currency" htmlFor="currency"><Input id="currency" name="currency" defaultValue={invoice?.currency ?? "USD"} minLength={3} maxLength={3} required /></Field>
      <Field label="Discount" htmlFor="discount"><Input id="discount" name="discount" inputMode="decimal" defaultValue={minorDisplay(invoice?.discountMinor ?? 0)} pattern="\d+(\.\d{1,2})?" required /></Field>
      <Field label="Tax (%)" htmlFor="taxRate"><Input id="taxRate" name="taxRate" inputMode="decimal" defaultValue={minorDisplay(invoice?.taxRateBps ?? 0)} pattern="\d+(\.\d{1,2})?" required /></Field>
    </div>

    <section className="space-y-3" aria-labelledby="line-items-heading">
      <div className="flex items-center justify-between gap-3"><div><h2 id="line-items-heading" className="font-semibold">Line items</h2><p className="text-sm text-muted-foreground">Amounts use the selected currency.</p></div><Button type="button" variant="outline" onClick={() => setItems((current) => [...current, { description: "", key: crypto.randomUUID(), quantity: 1, unitPriceMinor: 0 }])}>Add item</Button></div>
      {items.map((item, index) => <div key={item.key} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_7rem_10rem_auto] md:items-end">
        <Field label={`Item ${index + 1}`} htmlFor={`item-description-${item.key}`}><Input id={`item-description-${item.key}`} name="itemDescription" defaultValue={item.description} maxLength={500} required /></Field>
        <Field label="Quantity" htmlFor={`item-quantity-${item.key}`}><Input id={`item-quantity-${item.key}`} name="itemQuantity" type="number" min={1} max={1000000} defaultValue={item.quantity} required /></Field>
        <Field label="Unit price" htmlFor={`item-price-${item.key}`}><Input id={`item-price-${item.key}`} name="itemUnitPrice" inputMode="decimal" defaultValue={minorDisplay(item.unitPriceMinor)} pattern="\d+(\.\d{1,2})?" required /></Field>
        <Button type="button" variant="ghost" disabled={items.length === 1} onClick={() => setItems((current) => current.filter(({ key }) => key !== item.key))}>Remove</Button>
      </div>)}
    </section>

    <Field label="Notes" htmlFor="notes"><textarea id="notes" name="notes" rows={4} maxLength={5000} defaultValue={invoice?.notes ?? ""} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" /></Field>
    {state.message ? <p role="alert" className="text-sm text-destructive">{state.message}</p> : null}
    <div className="flex justify-end gap-3"><Link href={cancelHref} className={cn(buttonVariants({ variant: "outline" }))}>Cancel</Link><Button type="submit" disabled={pending || customers.length === 0}>{pending ? "Saving…" : invoice ? "Save draft" : "Create draft"}</Button></div>
  </form>;
}

function minorDisplay(value: number) { return (value / 100).toFixed(2); }
function Field({ children, className, htmlFor, label }: { children: React.ReactNode; className?: string; htmlFor: string; label: string }) { return <div className={cn("space-y-2", className)}><Label htmlFor={htmlFor}>{label}</Label>{children}</div>; }
