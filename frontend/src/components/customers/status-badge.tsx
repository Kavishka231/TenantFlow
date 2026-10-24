import { cn } from "@/lib/utils";

const styles = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  inactive: "bg-slate-100 text-slate-600 ring-slate-200",
  lead: "bg-amber-50 text-amber-700 ring-amber-200",
};

export function CustomerStatusBadge({
  status,
}: {
  status: "lead" | "active" | "inactive";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset",
        styles[status],
      )}
    >
      {status}
    </span>
  );
}
