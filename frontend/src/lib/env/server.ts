import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1).startsWith("postgresql://"),
  TENANTFLOW_BACKEND: z.enum(["fastapi", "typescript"]).default("fastapi"),
  FASTAPI_INTERNAL_URL: z.url().optional(),
  STRIPE_WEBHOOK_PROCESSOR: z.enum(["typescript", "python", "disabled"]).default("typescript"),
});

export function getServerEnv() {
  return serverEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    TENANTFLOW_BACKEND: process.env.TENANTFLOW_BACKEND,
    FASTAPI_INTERNAL_URL: process.env.FASTAPI_INTERNAL_URL,
    STRIPE_WEBHOOK_PROCESSOR: process.env.STRIPE_WEBHOOK_PROCESSOR,
  });
}
