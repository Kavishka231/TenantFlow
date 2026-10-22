import "dotenv/config";

import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.MIGRATION_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "MIGRATION_DATABASE_URL is required for Drizzle commands. Use development-only DDL credentials and never expose them to the browser.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
