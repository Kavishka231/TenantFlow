import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1).startsWith("postgresql://"),
});

export function getServerEnv() {
  return serverEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
  });
}
