import { expect, test, type Page } from "@playwright/test";

const configured = [process.env.DATABASE_URL, process.env.E2E_USER_EMAIL, process.env.E2E_USER_PASSWORD, process.env.E2E_SECOND_USER_EMAIL, process.env.E2E_SECOND_USER_PASSWORD, process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY].every(Boolean);
async function login(page: Page, email: string, password: string) { await page.goto("/login"); await page.getByLabel("Email").fill(email); await page.getByLabel("Password").fill(password); await page.getByRole("button", { name: "Sign in" }).click(); await expect(page).toHaveURL(/\/dashboard/); }

test.describe("sales pipeline", () => {
  test.skip(!configured, "A restricted database role and two confirmed Supabase users are required.");
  test("creates, transitions, records notes, and isolates a deal", async ({ page }) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; await login(page, process.env.E2E_USER_EMAIL!, process.env.E2E_USER_PASSWORD!); await page.goto("/organizations/new"); await page.getByLabel("Organization name").fill(`E2E Sales ${suffix}`); await page.getByLabel("Workspace URL").fill(`e2e-sales-${suffix}`); await page.getByRole("button", { name: "Create workspace" }).click();
    await page.getByRole("link", { name: "Customers" }).click(); await page.getByRole("link", { name: "New customer" }).click(); await page.getByLabel("Customer name").fill(`Sales Customer ${suffix}`); await page.getByRole("button", { name: "Create customer" }).click(); await page.goto("/dashboard"); await page.getByRole("link", { name: "Sales pipeline" }).click(); await page.getByRole("link", { name: "New deal" }).click();
    await page.getByLabel("Deal title").fill(`Deal ${suffix}`); await page.getByLabel("Customer").selectOption({ label: `Sales Customer ${suffix}` }); await page.getByLabel("Value").fill("1250.00"); await page.getByRole("button", { name: "Create deal" }).click(); await expect(page.getByText("$1,250.00")).toBeVisible(); const dealUrl = page.url().replace(/\?.*$/, "");
    await page.getByLabel("Move to stage").selectOption({ label: "Won (won)" }); await page.getByLabel("Outcome reason").fill("Signed agreement"); await page.getByRole("button", { name: "Update stage" }).click(); await expect(page.getByText("Won").first()).toBeVisible(); await page.getByLabel("Add note").fill("Kickoff scheduled"); await page.getByRole("button", { name: "Add note" }).click(); await expect(page.getByText("Kickoff scheduled")).toBeVisible();
    await page.goto("/dashboard"); await page.getByRole("button", { name: "Log out" }).click(); await login(page, process.env.E2E_SECOND_USER_EMAIL!, process.env.E2E_SECOND_USER_PASSWORD!); expect((await page.goto(dealUrl))?.status()).toBe(404);
  });
});
