import { expect, test, type Page } from "@playwright/test";

const authConfigured = [
  process.env.DATABASE_URL, process.env.E2E_USER_EMAIL, process.env.E2E_USER_PASSWORD,
  process.env.E2E_SECOND_USER_EMAIL, process.env.E2E_SECOND_USER_PASSWORD,
  process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
].every(Boolean);
const stripeConfigured = [
  process.env.STRIPE_SECRET_KEY, process.env.STRIPE_WEBHOOK_SECRET,
  process.env.STRIPE_STARTER_PRICE_ID, process.env.STRIPE_GROWTH_PRICE_ID,
].every(Boolean);

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("subscription billing", () => {
  test.skip(!authConfigured, "Live Supabase users and the restricted runtime database role are required.");

  test("keeps organization billing owner-only", async ({ page }) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await login(page, process.env.E2E_USER_EMAIL!, process.env.E2E_USER_PASSWORD!);
    await page.goto("/organizations/new");
    await page.getByLabel("Organization name").fill(`E2E Billing ${suffix}`);
    await page.getByLabel("Workspace URL").fill(`e2e-billing-${suffix}`);
    await page.getByRole("button", { name: "Create workspace" }).click();
    const billingLink = page.getByRole("link", { name: "Manage billing" });
    await expect(billingLink).toBeVisible();
    await billingLink.click();
    await expect(page.getByRole("heading", { name: "Subscription billing" })).toBeVisible();
    const billingUrl = page.url();
    await page.goto("/dashboard"); await page.getByRole("button", { name: "Log out" }).click();
    await login(page, process.env.E2E_SECOND_USER_EMAIL!, process.env.E2E_SECOND_USER_PASSWORD!);
    expect((await page.goto(billingUrl))?.status()).toBe(404);
  });

  test("redirects an owner to Stripe Test Checkout", async ({ page }) => {
    test.skip(!stripeConfigured, "Stripe Test Mode keys and recurring Price IDs are required.");
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await login(page, process.env.E2E_USER_EMAIL!, process.env.E2E_USER_PASSWORD!);
    await page.goto("/organizations/new");
    await page.getByLabel("Organization name").fill(`E2E Checkout ${suffix}`);
    await page.getByLabel("Workspace URL").fill(`e2e-checkout-${suffix}`);
    await page.getByRole("button", { name: "Create workspace" }).click();
    await page.getByRole("link", { name: "Manage billing" }).click();
    await page.getByRole("button", { name: "Choose Starter" }).click();
    await expect(page).toHaveURL(/^https:\/\/checkout\.stripe\.com\//);
  });
});
