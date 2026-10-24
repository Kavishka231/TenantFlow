import { expect, test, type Page } from "@playwright/test";

const liveConfiguration = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
  databaseUrl: process.env.DATABASE_URL,
  ownerEmail: process.env.E2E_USER_EMAIL,
  ownerPassword: process.env.E2E_USER_PASSWORD,
  outsiderEmail: process.env.E2E_SECOND_USER_EMAIL,
  outsiderPassword: process.env.E2E_SECOND_USER_PASSWORD,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
};
const hasLiveConfiguration = Object.values(liveConfiguration).every(Boolean);

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("customer management", () => {
  test.skip(
    !hasLiveConfiguration,
    "Live Supabase, migrated database, and two confirmed test accounts are required.",
  );

  test("creates, searches, updates, isolates, and deletes a customer", async ({ page }) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const organizationName = `E2E Customers ${suffix}`;
    const originalName = `Customer ${suffix}`;
    const updatedName = `Updated Customer ${suffix}`;

    await login(page, liveConfiguration.ownerEmail!, liveConfiguration.ownerPassword!);
    await page.goto("/organizations/new");
    await page.getByLabel("Organization name").fill(organizationName);
    await page.getByLabel("Workspace URL").fill(`e2e-customers-${suffix}`);
    await page.getByRole("button", { name: "Create workspace" }).click();
    await page.getByRole("link", { name: "Open customers" }).click();
    await page.getByRole("link", { name: "New customer" }).click();

    await page.getByLabel("Customer name").fill(originalName);
    await page.getByLabel("Email").fill(`customer-${suffix}@example.com`);
    await page.getByLabel("Phone").fill("+1 555 0100");
    await page.getByLabel("Company").fill("TenantFlow Test Company");
    await page.getByLabel("Status").selectOption("lead");
    await page.getByLabel("Address").fill("10 Test Street");
    await page.getByLabel("Notes").fill("Created by Playwright");
    await page.getByRole("button", { name: "Create customer" }).click();
    await expect(page.getByRole("heading", { name: originalName })).toBeVisible();
    const customerUrl = page.url().replace(/\?.*$/, "");

    await page.getByRole("link", { name: "Edit" }).click();
    await page.getByLabel("Customer name").fill(updatedName);
    await page.getByLabel("Status").selectOption("active");
    await page.getByRole("button", { name: "Save customer" }).click();
    await expect(page.getByRole("heading", { name: updatedName })).toBeVisible();

    await page.getByRole("link", { name: "Back to customers" }).click();
    await page.getByLabel("Search customers").fill(updatedName);
    await page.getByLabel("Status").selectOption("active");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByRole("heading", { name: updatedName })).toBeVisible();

    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Log out" }).click();
    await login(page, liveConfiguration.outsiderEmail!, liveConfiguration.outsiderPassword!);
    const unauthorizedResponse = await page.goto(customerUrl);
    expect(unauthorizedResponse?.status()).toBe(404);

    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Log out" }).click();
    await login(page, liveConfiguration.ownerEmail!, liveConfiguration.ownerPassword!);
    await page.goto(customerUrl);
    await page.getByRole("link", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete customer" }).click();
    await expect(page.getByRole("status")).toContainText("deleted");
  });
});
