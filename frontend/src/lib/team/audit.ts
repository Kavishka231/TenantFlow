import "server-only";

import { desc, eq } from "drizzle-orm";

import { withUserContext } from "@/db/client";
import { auditEvents } from "@/db/schema";

export function listAuditEventsForUser(
  userId: string,
  organizationId: string,
  limit = 50,
) {
  return withUserContext(userId, (transaction) =>
    transaction
      .select({
        actorId: auditEvents.actorId,
        createdAt: auditEvents.createdAt,
        eventType: auditEvents.eventType,
        id: auditEvents.id,
        metadata: auditEvents.metadata,
      })
      .from(auditEvents)
      .where(eq(auditEvents.organizationId, organizationId))
      .orderBy(desc(auditEvents.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100)),
  );
}
