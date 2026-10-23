import { expect, test, type Page } from "@playwright/test";

const liveConfiguration = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
  databaseUrl: process.env.DATABASE_URL,
  ownerEmail: process.env.E2E_USER_EMAIL,
  ownerPassword: process.env.E2E_USER_PASSWORD,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  outsiderEmail: process.env.E2E_SECOND_USER_EMAIL,
  outsiderPassword: process.env.E2E_SECOND_USER_PASSWORD,
};
const hasLiveConfiguration = Object.values(liveConfiguration).every(Boolean);

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("authentication and organization workspaces", () => {
  test.skip(
    !hasLiveConfiguration,
    "Live Supabase URL, runtime database, and two confirmed test accounts are required.",
  );

  test("redirects anonymous users away from protected routes", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);

    await page.goto("/organizations");
    await expect(page).toHaveURL(/\/login\?next=%2Forganizations/);
  });

  test("creates, switches, and isolates organization workspaces", async ({ page }) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const firstName = `E2E Alpha ${suffix}`;
    const secondName = `E2E Beta ${suffix}`;
    const firstSlug = `e2e-alpha-${suffix}`;
    const secondSlug = `e2e-beta-${suffix}`;

    await login(
      page,
      liveConfiguration.ownerEmail!,
      liveConfiguration.ownerPassword!,
    );

    await page.goto("/organizations/new");
    await page.getByLabel("Organization name").fill(firstName);
    await page.getByLabel("Workspace URL").fill(firstSlug);
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page.getByRole("heading", { name: firstName })).toBeVisible();

    await page.goto("/organizations");
    const firstCard = page.locator('[data-slot="card"]').filter({ hasText: firstName });
    const firstOrganizationId = await firstCard
      .locator('input[name="organizationId"]')
      .inputValue();

    await page.goto("/organizations/new");
    await page.getByLabel("Organization name").fill(secondName);
    await page.getByLabel("Workspace URL").fill(secondSlug);
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page.getByRole("heading", { name: secondName })).toBeVisible();

    await page.goto("/organizations");
    await firstCard.getByRole("button", { name: "Open workspace" }).click();
    await expect(page.getByRole("heading", { name: firstName })).toBeVisible();

    await page.getByRole("button", { name: "Log out" }).click();
    await login(
      page,
      liveConfiguration.outsiderEmail!,
      liveConfiguration.outsiderPassword!,
    );
    const response = await page.goto(`/organizations/${firstOrganizationId}`);
    expect(response?.status()).toBe(404);
  });

  test("expires a cleared session and protects the dashboard", async ({ page, context }) => {
    await login(
      page,
      liveConfiguration.ownerEmail!,
      liveConfiguration.ownerPassword!,
    );
    await context.clearCookies();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  });
});
