import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1).startsWith("postgresql://"),
  FASTAPI_INTERNAL_URL: z.url().optional(),
  STRIPE_WEBHOOK_PROCESSOR: z.enum(["typescript", "python", "disabled"]).default("typescript"),
});

export function getServerEnv() {
  return serverEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    FASTAPI_INTERNAL_URL: process.env.FASTAPI_INTERNAL_URL,
    STRIPE_WEBHOOK_PROCESSOR: process.env.STRIPE_WEBHOOK_PROCESSOR,
  });
}
