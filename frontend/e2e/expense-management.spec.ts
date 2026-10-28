import { expect, test, type Page } from "@playwright/test";

const configured = [process.env.DATABASE_URL, process.env.E2E_USER_EMAIL, process.env.E2E_USER_PASSWORD, process.env.E2E_SECOND_USER_EMAIL, process.env.E2E_SECOND_USER_PASSWORD, process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY].every(Boolean);
async function login(page: Page, email: string, password: string) { await page.goto("/login"); await page.getByLabel("Email").fill(email); await page.getByLabel("Password").fill(password); await page.getByRole("button", { name: "Sign in" }).click(); await expect(page).toHaveURL(/\/dashboard/); }

test.describe("expense management", () => {
  test.skip(!configured, "A migrated development project and two confirmed Supabase users are required.");
  test("creates, filters, pays, attaches a private receipt, isolates, and deletes an expense", async ({ page }) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await login(page, process.env.E2E_USER_EMAIL!, process.env.E2E_USER_PASSWORD!);
    await page.goto("/organizations/new"); await page.getByLabel("Organization name").fill(`E2E Expenses ${suffix}`); await page.getByLabel("Workspace URL").fill(`e2e-expenses-${suffix}`); await page.getByRole("button", { name: "Create workspace" }).click();
    await page.goto("/dashboard"); await page.getByRole("link", { name: "Expenses" }).click(); await page.getByRole("link", { name: "New expense" }).click();
    await page.getByLabel("Vendor").fill(`Cloud Vendor ${suffix}`); await page.getByLabel("Amount").fill("49.99"); await page.getByLabel("Currency").selectOption("USD"); await page.getByLabel("Category").selectOption({ label: "Software" }); await page.getByLabel("Payment method").selectOption("card"); await page.getByLabel("Status").selectOption("pending"); await page.getByRole("button", { name: "Create expense" }).click();
    await expect(page.getByText("$49.99")).toBeVisible(); const expenseUrl = page.url().replace(/\?.*$/, "");
    await page.getByLabel("Receipt file").setInputFiles({ name: "receipt.pdf", mimeType: "application/pdf", buffer: Buffer.from("TenantFlow E2E receipt") }); await page.getByRole("button", { name: "Upload receipt" }).click(); await expect(page.getByRole("status")).toContainText("uploaded"); await expect(page.getByRole("link", { name: "Download" })).toBeVisible();
    await page.getByLabel("Status").selectOption("paid"); await page.getByLabel("Payment date").fill(new Date().toISOString().slice(0, 10)); await page.getByRole("button", { name: "Update payment status" }).click(); await expect(page.getByText("paid", { exact: true }).first()).toBeVisible();
    await page.getByRole("link", { name: "Expenses" }).click(); await page.getByLabel("Search expenses").fill(`Cloud Vendor ${suffix}`); await page.getByRole("button", { name: "Apply" }).click(); await expect(page.getByText(`Cloud Vendor ${suffix}`)).toBeVisible();
    await page.goto("/dashboard"); await page.getByRole("button", { name: "Log out" }).click(); await login(page, process.env.E2E_SECOND_USER_EMAIL!, process.env.E2E_SECOND_USER_PASSWORD!); expect((await page.goto(expenseUrl))?.status()).toBe(404);
    await page.goto("/dashboard"); await page.getByRole("button", { name: "Log out" }).click(); await login(page, process.env.E2E_USER_EMAIL!, process.env.E2E_USER_PASSWORD!); await page.goto(expenseUrl); await page.getByRole("link", { name: "Delete" }).click(); await page.getByRole("button", { name: "Delete" }).click(); await expect(page.getByRole("status")).toContainText("deleted");
  });
});
