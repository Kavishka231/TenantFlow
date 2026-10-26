import { Button } from "@/components/ui/button";
import type { AnalyticsRange } from "@/lib/analytics/range";

export function DateRangeFilter({ range }: { range: AnalyticsRange }) {
  return <form method="get" className="flex flex-wrap items-end gap-2 rounded-xl border bg-white p-3 shadow-sm">
    <div><label htmlFor="analytics-preset" className="mb-1 block text-xs font-medium text-muted-foreground">Date range</label><select id="analytics-preset" name="preset" defaultValue={range.preset} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
      <option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="6m">Last 6 months</option><option value="12m">Last 12 months</option><option value="custom">Custom</option>
    </select></div>
    <div><label htmlFor="analytics-start" className="mb-1 block text-xs font-medium text-muted-foreground">From</label><input id="analytics-start" name="start" type="date" defaultValue={range.start} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" /></div>
    <div><label htmlFor="analytics-end" className="mb-1 block text-xs font-medium text-muted-foreground">To</label><input id="analytics-end" name="end" type="date" defaultValue={range.end} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" /></div>
    <Button type="submit" variant="outline">Apply</Button>
  </form>;
}
