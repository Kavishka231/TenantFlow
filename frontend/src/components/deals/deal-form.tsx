"use client";

import Link from "next/link";
import { useActionState } from "react";

import { createDealAction, updateDealAction } from "@/app/deals/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialDealActionState } from "@/lib/deals/action-state";
import { cn } from "@/lib/utils";

type Options = Awaited<ReturnType<typeof import("@/lib/deals/data").getDealFormOptions>>;
type DealValue = { id: string; title: string; description: string | null; customerId: string; stageId: string; assignedUserId: string | null; valueMinor: number; currency: string; expectedCloseDate: string | null; version: number };

export function DealForm({ organizationId, options, deal }: { organizationId: string; options: Options; deal?: DealValue }) {
  const [state, action, pending] = useActionState(deal ? updateDealAction : createDealAction, initialDealActionState);
  return <form action={action} className="space-y-6"><input type="hidden" name="organizationId" value={organizationId} />{deal ? <><input type="hidden" name="dealId" value={deal.id} /><input type="hidden" name="version" value={deal.version} /></> : null}<div className="grid gap-5 md:grid-cols-2">
    <Field label="Deal title" id="deal-title" wide><Input id="deal-title" name="title" defaultValue={deal?.title} maxLength={200} required /></Field>
    <Field label="Customer" id="deal-customer"><select id="deal-customer" name="customerId" defaultValue={deal?.customerId} required className={selectClass}><option value="">Select customer</option>{options.customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name}{customer.company ? ` · ${customer.company}` : ""}</option>)}</select></Field>
    <Field label="Stage" id="deal-stage"><select id="deal-stage" name="stageId" defaultValue={deal?.stageId ?? options.stages.find(stage => stage.kind === "open")?.id} required className={selectClass}>{options.stages.map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select></Field>
    <Field label="Value" id="deal-value"><Input id="deal-value" name="value" inputMode="decimal" defaultValue={deal ? (deal.valueMinor / 100).toFixed(2) : "0.00"} required /></Field>
    <Field label="Currency" id="deal-currency"><Input id="deal-currency" name="currency" defaultValue={deal?.currency ?? "USD"} minLength={3} maxLength={3} required /></Field>
    <Field label="Expected close date" id="deal-close"><Input id="deal-close" name="expectedCloseDate" type="date" defaultValue={deal?.expectedCloseDate ?? ""} /></Field>
    <Field label="Assigned team member" id="deal-assignee"><select id="deal-assignee" name="assignedUserId" defaultValue={deal?.assignedUserId ?? ""} className={selectClass}><option value="">Unassigned</option>{options.members.map(member => <option key={member.userId} value={member.userId}>{member.fullName ?? "Unnamed teammate"} ({member.role})</option>)}</select></Field>
    <Field label="Description" id="deal-description" wide><textarea id="deal-description" name="description" defaultValue={deal?.description ?? ""} maxLength={5000} rows={5} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" /></Field>
  </div>{state.message ? <p role="alert" className="text-sm text-destructive">{state.message}</p> : null}<div className="flex justify-end gap-3"><Link href={deal ? `/organizations/${organizationId}/deals/${deal.id}` : `/organizations/${organizationId}/pipeline`} className={cn(buttonVariants({ variant: "outline" }))}>Cancel</Link><Button type="submit" disabled={pending}>{pending ? "Saving…" : deal ? "Save deal" : "Create deal"}</Button></div></form>;
}
const selectClass = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm";
function Field({ label, id, wide, children }: { label: string; id: string; wide?: boolean; children: React.ReactNode }) { return <div className={cn("space-y-2", wide && "md:col-span-2")}><Label htmlFor={id}>{label}</Label>{children}</div>; }
