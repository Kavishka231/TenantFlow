import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1).startsWith("postgresql://"),
  FASTAPI_INTERNAL_URL: z.url().optional(),
});

export function getServerEnv() {
  return serverEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    FASTAPI_INTERNAL_URL: process.env.FASTAPI_INTERNAL_URL,
  });
}
