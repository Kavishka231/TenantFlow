"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  createCustomerAction,
  updateCustomerAction,
} from "@/app/customers/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialCustomerActionState } from "@/lib/customers/action-state";
import { cn } from "@/lib/utils";

type CustomerFormValue = {
  address: string | null;
  company: string | null;
  email: string | null;
  id: string;
  name: string;
  notes: string | null;
  phone: string | null;
  status: "lead" | "active" | "inactive";
  version: number;
};

export function CustomerForm({
  customer,
  organizationId,
}: {
  customer?: CustomerFormValue;
  organizationId: string;
}) {
  const action = customer ? updateCustomerAction : createCustomerAction;
  const [state, formAction, pending] = useActionState(
    action,
    initialCustomerActionState,
  );
  const cancelHref = customer
    ? `/organizations/${organizationId}/customers/${customer.id}`
    : `/organizations/${organizationId}/customers`;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="organizationId" value={organizationId} />
      {customer ? (
        <>
          <input type="hidden" name="customerId" value={customer.id} />
          <input type="hidden" name="version" value={customer.version} />
        </>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Customer name" htmlFor="name" className="md:col-span-2">
          <Input
            id="name"
            name="name"
            defaultValue={customer?.name}
            maxLength={160}
            autoComplete="name"
            required
          />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={customer?.email ?? ""}
            maxLength={320}
            autoComplete="email"
          />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={customer?.phone ?? ""}
            maxLength={32}
            autoComplete="tel"
          />
        </Field>
        <Field label="Company" htmlFor="company">
          <Input
            id="company"
            name="company"
            defaultValue={customer?.company ?? ""}
            maxLength={160}
            autoComplete="organization"
          />
        </Field>
        <Field label="Status" htmlFor="status">
          <select
            id="status"
            name="status"
            defaultValue={customer?.status ?? "lead"}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="lead">Lead</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
        <Field label="Address" htmlFor="address" className="md:col-span-2">
          <textarea
            id="address"
            name="address"
            defaultValue={customer?.address ?? ""}
            maxLength={1000}
            rows={3}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </Field>
        <Field label="Notes" htmlFor="notes" className="md:col-span-2">
          <textarea
            id="notes"
            name="notes"
            defaultValue={customer?.notes ?? ""}
            maxLength={5000}
            rows={6}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </Field>
      </div>

      {state.message ? (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-3">
        <Link
          href={cancelHref}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Cancel
        </Link>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Saving…"
            : customer
              ? "Save customer"
              : "Create customer"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  children,
  className,
  htmlFor,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
