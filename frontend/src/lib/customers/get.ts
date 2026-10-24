import "server-only";

import { and, eq } from "drizzle-orm";

import { withUserContext } from "@/db/client";
import { customers } from "@/db/schema";

export function getCustomerForUser(
  userId: string,
  organizationId: string,
  customerId: string,
) {
  return withUserContext(userId, async (transaction) => {
    const [customer] = await transaction
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.id, customerId),
          eq(customers.organizationId, organizationId),
        ),
      )
      .limit(1);

    return customer ?? null;
  });
}
