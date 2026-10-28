"use client";

import { Download, Paperclip, Trash2, Upload } from "lucide-react";
import { useActionState } from "react";

import { removeExpenseReceiptAction, uploadExpenseReceiptAction } from "@/app/expenses/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialExpenseActionState } from "@/lib/expenses/action-state";

export function ReceiptManager({ canManage, expenseId, name, organizationId, size, version }: { canManage: boolean; expenseId: string; name: string | null; organizationId: string; size: number | null; version: number }) {
  const [state, action, pending] = useActionState(uploadExpenseReceiptAction, initialExpenseActionState);
  if (name) return <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><Paperclip className="size-5 text-indigo-600"/><div><p className="text-sm font-medium">{name}</p><p className="text-xs text-muted-foreground">{size ? `${Math.ceil(size / 1024)} KB` : "Private receipt"}</p></div></div><div className="flex gap-2"><a href={`/organizations/${organizationId}/expenses/${expenseId}/receipt`} className={buttonVariants({ variant: "outline" })}><Download/>Download</a>{canManage?<form action={removeExpenseReceiptAction}><input type="hidden" name="organizationId" value={organizationId}/><input type="hidden" name="expenseId" value={expenseId}/><input type="hidden" name="version" value={version}/><Button type="submit" variant="destructive"><Trash2/>Remove</Button></form>:null}</div></div>;
  if (!canManage) return <p className="text-sm text-muted-foreground">No receipt uploaded.</p>;
  return <form action={action} className="space-y-4" encType="multipart/form-data"><input type="hidden" name="organizationId" value={organizationId}/><input type="hidden" name="expenseId" value={expenseId}/><input type="hidden" name="version" value={version}/><label htmlFor="expense-receipt" className="text-sm font-medium">Receipt file</label><Input id="expense-receipt" name="receipt" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required/><p className="text-xs text-muted-foreground">Private PDF, JPEG, PNG, or WebP up to 5 MB.</p>{state.message?<p role="alert" className="text-sm text-destructive">{state.message}</p>:null}<Button type="submit" disabled={pending}><Upload/>{pending?"Uploading...":"Upload receipt"}</Button></form>;
}
