"use client";

import { useActionState } from "react";

import { changeExpenseStatusAction } from "@/app/expenses/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialExpenseActionState } from "@/lib/expenses/action-state";

export function ExpenseStatusForm({ expenseId, organizationId, paidDate, status, version }: { expenseId: string; organizationId: string; paidDate: string | null; status: string; version: number }) {
  const [state, action, pending] = useActionState(changeExpenseStatusAction, initialExpenseActionState);
  return <form action={action} className="space-y-4">
    <input type="hidden" name="expenseId" value={expenseId} /><input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="version" value={version} />
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="expense-status">Status</Label><select id="expense-status" name="status" defaultValue={status} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"><option value="pending">Pending</option><option value="paid">Paid</option><option value="reimbursed">Reimbursed</option><option value="cancelled">Cancelled</option></select></div><div className="space-y-2"><Label htmlFor="expense-paid-date">Payment date</Label><Input id="expense-paid-date" name="paidDate" type="date" defaultValue={paidDate ?? ""} /></div></div>
    {state.message ? <p role="alert" className="text-sm text-destructive">{state.message}</p> : null}<Button type="submit" disabled={pending}>{pending ? "Updating..." : "Update payment status"}</Button>
  </form>;
}
