import "server-only";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { withUserContext } from "@/db/client";
import { customers } from "@/db/schema";

export function getCustomerForUser(
  userId: string,
  organizationId: string,
  customerId: string,
) {
  const identity = z
    .object({ customerId: z.uuid(), organizationId: z.uuid() })
    .safeParse({ customerId, organizationId });

  if (!identity.success) {
    return null;
  }

  return withUserContext(userId, async (transaction) => {
    const [customer] = await transaction
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.id, identity.data.customerId),
          eq(customers.organizationId, identity.data.organizationId),
        ),
      )
      .limit(1);

    return customer ?? null;
  });
}
