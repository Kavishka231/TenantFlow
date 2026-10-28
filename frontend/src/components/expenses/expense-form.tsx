"use client";

import Link from "next/link";
import { useActionState } from "react";

import { createExpenseAction, updateExpenseAction } from "@/app/expenses/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialExpenseActionState } from "@/lib/expenses/action-state";
import { expenseAmountInput } from "@/lib/expenses/money";
import { cn } from "@/lib/utils";

type Category = { color: string; id: string; name: string };
type Expense = {
  amountMinor: number; categoryId: string; currency: string; description: string | null;
  expenseDate: string; id: string; paidDate: string | null; paymentMethod: "cash" | "bank_transfer" | "card" | "check" | "other";
  status: "pending" | "paid" | "reimbursed" | "cancelled"; vendor: string; version: number;
};

export function ExpenseForm({ categories, expense, organizationId }: { categories: Category[]; expense?: Expense; organizationId: string }) {
  const [state, formAction, pending] = useActionState(expense ? updateExpenseAction : createExpenseAction, initialExpenseActionState);
  const cancelHref = expense ? `/organizations/${organizationId}/expenses/${expense.id}` : `/organizations/${organizationId}/expenses`;
  return <form action={formAction} className="space-y-6">
    <input type="hidden" name="organizationId" value={organizationId} />
    {expense ? <><input type="hidden" name="expenseId" value={expense.id} /><input type="hidden" name="version" value={expense.version} /></> : null}
    <div className="grid gap-5 md:grid-cols-2">
      <Field label="Vendor" htmlFor="vendor" className="md:col-span-2"><Input id="vendor" name="vendor" defaultValue={expense?.vendor} maxLength={160} required /></Field>
      <Field label="Amount" htmlFor="amount"><Input id="amount" name="amount" type="number" min="0.01" max="10000000000" step="0.01" defaultValue={expense ? expenseAmountInput(expense.amountMinor) : ""} required /></Field>
      <Field label="Currency" htmlFor="currency"><select id="currency" name="currency" defaultValue={expense?.currency ?? "USD"} className={selectClass}>{["USD","EUR","GBP","LKR"].map(value => <option key={value}>{value}</option>)}</select></Field>
      <Field label="Expense date" htmlFor="expenseDate"><Input id="expenseDate" name="expenseDate" type="date" defaultValue={expense?.expenseDate ?? new Date().toISOString().slice(0, 10)} required /></Field>
      <Field label="Category" htmlFor="categoryId"><select id="categoryId" name="categoryId" defaultValue={expense?.categoryId ?? categories[0]?.id} className={selectClass} required>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
      <Field label="Payment method" htmlFor="paymentMethod"><select id="paymentMethod" name="paymentMethod" defaultValue={expense?.paymentMethod ?? "card"} className={selectClass}>{methodOptions.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label="Status" htmlFor="status"><select id="status" name="status" defaultValue={expense?.status ?? "pending"} className={selectClass}>{statusOptions.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label="Payment date" htmlFor="paidDate"><Input id="paidDate" name="paidDate" type="date" defaultValue={expense?.paidDate ?? ""} /><p className="text-xs text-muted-foreground">Required for paid or reimbursed expenses; leave blank otherwise.</p></Field>
      <Field label="Description" htmlFor="description" className="md:col-span-2"><textarea id="description" name="description" defaultValue={expense?.description ?? ""} maxLength={5000} rows={5} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" /></Field>
    </div>
    {state.message ? <p role="alert" className="text-sm text-destructive">{state.message}</p> : null}
    <div className="flex justify-end gap-3"><Link href={cancelHref} className={cn(buttonVariants({ variant: "outline" }))}>Cancel</Link><Button type="submit" disabled={pending}>{pending ? "Saving..." : expense ? "Save expense" : "Create expense"}</Button></div>
  </form>;
}

const selectClass = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const statusOptions = [["pending","Pending"],["paid","Paid"],["reimbursed","Reimbursed"],["cancelled","Cancelled"]] as const;
const methodOptions = [["cash","Cash"],["bank_transfer","Bank transfer"],["card","Card"],["check","Check"],["other","Other"]] as const;
function Field({ children, className, htmlFor, label }: { children: React.ReactNode; className?: string; htmlFor: string; label: string }) { return <div className={cn("space-y-2", className)}><Label htmlFor={htmlFor}>{label}</Label>{children}</div>; }
