import { z } from "zod";

export const paidPlanKeySchema = z.enum(["starter", "growth"]);

export const checkoutInputSchema = z.object({
  organizationId: z.uuid(),
  planKey: paidPlanKeySchema,
});

export const portalInputSchema = z.object({ organizationId: z.uuid() });
