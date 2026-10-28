import { expect, test, type Page } from "@playwright/test";

const configured = [
  process.env.DATABASE_URL, process.env.E2E_USER_EMAIL, process.env.E2E_USER_PASSWORD,
  process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
].every(Boolean);

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_USER_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_USER_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("business dashboard analytics", () => {
  test.skip(!configured, "A restricted runtime database connection and confirmed Supabase test user are required.");

  test("renders real empty states and updates customer metrics", async ({ page }) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await login(page);
    await page.goto("/organizations/new");
    await page.getByLabel("Organization name").fill(`E2E Analytics ${suffix}`);
    await page.getByLabel("Workspace URL").fill(`e2e-analytics-${suffix}`);
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page.getByText("No invoice or payment data in this period.")).toBeVisible();
    await expect(page.getByText("No activity in this period.")).toBeVisible();
    await page.getByRole("link", { name: "Customers" }).click();
    await page.getByRole("link", { name: "New customer" }).click();
    await page.getByLabel("Customer name").fill(`Analytics Customer ${suffix}`);
    await page.getByRole("button", { name: "Create customer" }).click();
    await page.goto("/dashboard?preset=30d");
    await expect(page.getByText("Total customers").locator("..").getByText("1", { exact: true })).toBeVisible();
    await expect(page.getByText(`Analytics Customer ${suffix}`)).toBeVisible();
  });
});
