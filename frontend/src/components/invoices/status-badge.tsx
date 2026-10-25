import { effectiveInvoiceStatus } from "@/lib/invoices/money";
import { cn } from "@/lib/utils";

const styles = {
  cancelled: "bg-slate-100 text-slate-700",
  draft: "bg-slate-100 text-slate-700",
  overdue: "bg-red-100 text-red-800",
  paid: "bg-emerald-100 text-emerald-800",
  partially_paid: "bg-amber-100 text-amber-900",
  sent: "bg-blue-100 text-blue-800",
} as const;

export function InvoiceStatusBadge({ dueDate, status }: { dueDate: string; status: keyof typeof styles }) {
  const effective = effectiveInvoiceStatus(status, dueDate);
  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium capitalize", styles[effective])}>{effective.replace("_", " ")}</span>;
}
