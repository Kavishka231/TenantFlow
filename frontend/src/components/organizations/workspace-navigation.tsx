"use client";

import {
  ChartNoAxesCombined,
  ContactRound,
  CreditCard,
  FileText,
  KanbanSquare,
  ReceiptText,
  Settings,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type WorkspaceRole = "owner" | "admin" | "member";

export function WorkspaceNavigation({
  organizationId,
  role,
}: {
  organizationId: string;
  role: WorkspaceRole;
}) {
  const pathname = usePathname();
  const base = `/organizations/${organizationId}`;
  const items = [
    { href: "/dashboard", label: "Overview", icon: ChartNoAxesCombined },
    { href: `${base}/customers`, label: "Customers", icon: ContactRound },
    { href: `${base}/invoices`, label: "Invoices", icon: FileText },
    { href: `${base}/pipeline`, label: "Sales", icon: KanbanSquare },
    { href: `${base}/expenses`, label: "Expenses", icon: ReceiptText },
    ...(role !== "member"
      ? [{ href: `${base}/team`, label: "Team", icon: UsersRound }]
      : []),
    ...(role === "owner"
      ? [{ href: `${base}/billing`, label: "Billing", icon: CreditCard }]
      : []),
    ...(role !== "member"
      ? [{ href: `${base}/settings`, label: "Settings", icon: Settings }]
      : []),
  ];

  return (
    <nav
      aria-label="Workspace navigation"
      className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
    >
      <div className="flex min-w-max gap-1 rounded-xl border bg-white p-1 shadow-sm">
        {items.map(({ href, icon: Icon, label }) => {
          const active = href === "/dashboard"
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active && "bg-indigo-50 text-indigo-700",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
