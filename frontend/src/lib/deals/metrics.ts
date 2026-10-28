import "server-only";

import { and, count, eq, gte, lt, sql } from "drizzle-orm";

import { withUserContext } from "@/db/client";
import { deals, pipelineStages } from "@/db/schema";
import type { AnalyticsRange } from "@/lib/analytics/range";
import { calculateConversionRate } from "@/lib/deals/metrics-model";

export function getSalesMetricsForUser(userId: string, organizationId: string, range: AnalyticsRange) {
  return withUserContext(userId, async transaction => {
    const [pipelineValue, wonRevenue, stages, closed] = await Promise.all([
      transaction.select({ currency: deals.currency, amountMinor: sql<number>`coalesce(sum(${deals.valueMinor}),0)::double precision`, count: count() })
        .from(deals).where(and(eq(deals.organizationId, organizationId), eq(deals.outcome, "open"))).groupBy(deals.currency).orderBy(deals.currency),
      transaction.select({ currency: deals.currency, amountMinor: sql<number>`coalesce(sum(${deals.valueMinor}),0)::double precision`, count: count() })
        .from(deals).where(and(eq(deals.organizationId, organizationId), eq(deals.outcome, "won"), gte(deals.closedAt, new Date(`${range.start}T00:00:00Z`)), lt(deals.closedAt, new Date(`${range.endExclusive}T00:00:00Z`)))).groupBy(deals.currency).orderBy(deals.currency),
      transaction.select({ stageId: pipelineStages.id, stageName: pipelineStages.name, color: pipelineStages.color, kind: pipelineStages.kind, count: count(deals.id) })
        .from(pipelineStages).leftJoin(deals, and(eq(deals.stageId, pipelineStages.id), eq(deals.organizationId, pipelineStages.organizationId)))
        .where(eq(pipelineStages.organizationId, organizationId)).groupBy(pipelineStages.id).orderBy(pipelineStages.position),
      transaction.select({ outcome: deals.outcome, count: count() }).from(deals)
        .where(and(eq(deals.organizationId, organizationId), sql`${deals.outcome} in ('won','lost')`, gte(deals.closedAt, new Date(`${range.start}T00:00:00Z`)), lt(deals.closedAt, new Date(`${range.endExclusive}T00:00:00Z`))))
        .groupBy(deals.outcome),
    ]);
    const won = closed.find(row => row.outcome === "won")?.count ?? 0;
    const lost = closed.find(row => row.outcome === "lost")?.count ?? 0;
    return { pipelineValue, wonRevenue, stages, wonDeals: won, lostDeals: lost, conversionRate: calculateConversionRate(won, lost) };
  });
}
