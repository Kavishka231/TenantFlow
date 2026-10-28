import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

import { withUserContext } from "@/db/client";
import {
  organizationSubscriptions,
  stripeCustomers,
  subscriptionPlans,
} from "@/db/schema";

export function listActivePlansForUser(userId: string) {
  return withUserContext(userId, (transaction) =>
    transaction
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.active, true))
      .orderBy(asc(subscriptionPlans.sortOrder)),
  );
}

export function getBillingForUser(userId: string, organizationId: string) {
  return withUserContext(userId, async (transaction) => {
    const [customer] = await transaction
      .select({ stripeCustomerId: stripeCustomers.stripeCustomerId })
      .from(stripeCustomers)
      .where(eq(stripeCustomers.organizationId, organizationId))
      .limit(1);
    const [subscription] = await transaction
      .select({
        cancelAtPeriodEnd: organizationSubscriptions.cancelAtPeriodEnd,
        currentPeriodEnd: organizationSubscriptions.currentPeriodEnd,
        planKey: subscriptionPlans.key,
        planName: subscriptionPlans.name,
        status: organizationSubscriptions.status,
      })
      .from(organizationSubscriptions)
      .innerJoin(subscriptionPlans, eq(organizationSubscriptions.planId, subscriptionPlans.id))
      .where(and(eq(organizationSubscriptions.organizationId, organizationId)))
      .limit(1);
    return { customer: customer ?? null, subscription: subscription ?? null };
  });
}

export function registerStripeCustomerForUser(
  userId: string,
  organizationId: string,
  stripeCustomerId: string,
) {
  return withUserContext(userId, (transaction) =>
    transaction.execute(sql`select public.register_stripe_customer(
      ${organizationId}::uuid,
      ${stripeCustomerId}::text
    )`),
  );
}
