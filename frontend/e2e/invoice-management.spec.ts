import { expect, test, type Page } from "@playwright/test";

const configuration = {
  databaseUrl: process.env.DATABASE_URL,
  ownerEmail: process.env.E2E_USER_EMAIL,
  ownerPassword: process.env.E2E_USER_PASSWORD,
  outsiderEmail: process.env.E2E_SECOND_USER_EMAIL,
  outsiderPassword: process.env.E2E_SECOND_USER_PASSWORD,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
};
const configured = Object.values(configuration).every(Boolean);

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("invoice management", () => {
  test.skip(!configured, "A restricted runtime database connection and two confirmed Supabase test users are required.");

  test("creates, sends, pays, downloads, and isolates an invoice", async ({ page }) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await login(page, configuration.ownerEmail!, configuration.ownerPassword!);
    await page.goto("/organizations/new");
    await page.getByLabel("Organization name").fill(`E2E Invoices ${suffix}`);
    await page.getByLabel("Workspace URL").fill(`e2e-invoices-${suffix}`);
    await page.getByRole("button", { name: "Create workspace" }).click();
    await page.getByRole("link", { name: "Open customers" }).click();
    await page.getByRole("link", { name: "New customer" }).click();
    await page.getByLabel("Customer name").fill(`Invoice Customer ${suffix}`);
    await page.getByLabel("Status").selectOption("active");
    await page.getByRole("button", { name: "Create customer" }).click();
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Open invoices" }).click();
    await page.getByRole("link", { name: "New invoice" }).click();
    await page.getByLabel("Customer").selectOption({ label: `Invoice Customer ${suffix}` });
    await page.getByLabel("Due date").fill("2027-12-31");
    await page.getByLabel("Item 1").fill("Implementation service");
    await page.getByLabel("Quantity").fill("2");
    await page.getByLabel("Unit price").fill("50.00");
    await page.getByLabel("Tax (%)").fill("10.00");
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page.getByText("$110.00").first()).toBeVisible();
    const invoiceUrl = page.url().replace(/\?.*$/, "");
    await page.getByRole("button", { name: "Send" }).click();
    await page.getByLabel("Amount").fill("40.00");
    await page.getByLabel("Payment date").fill(new Date().toISOString().slice(0, 10));
    await page.getByLabel("Method").selectOption("bank_transfer");
    await page.getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByText("$70.00").first()).toBeVisible();

    const pdfResponse = await page.request.get(`${invoiceUrl}/pdf`);
    expect(pdfResponse.ok()).toBe(true);
    expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");

    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Log out" }).click();
    await login(page, configuration.outsiderEmail!, configuration.outsiderPassword!);
    expect((await page.goto(invoiceUrl))?.status()).toBe(404);
  });
});
