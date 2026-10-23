import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env.test.local", override: true, quiet: true });

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
const hasLiveConfiguration = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  process.env.DATABASE_URL,
  process.env.E2E_USER_EMAIL,
  process.env.E2E_USER_PASSWORD,
  process.env.E2E_SECOND_USER_EMAIL,
  process.env.E2E_SECOND_USER_PASSWORD,
].every(Boolean);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: hasLiveConfiguration
    ? {
        command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        url: baseURL,
      }
    : undefined,
});
