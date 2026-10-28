import { cn } from "@/lib/utils";

const styles = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  reimbursed: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-200",
} as const;

export function ExpenseStatusBadge({ status }: { status: keyof typeof styles }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset", styles[status])}>{status}</span>;
}
