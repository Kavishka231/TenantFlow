import { expect, test } from "@playwright/test";

test.describe("public portfolio experience", () => {
  test("navigates from the landing page to Test Mode pricing", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Run your business",
    );
    await expect(page.getByText("PostgreSQL RLS")).toBeVisible();

    await page.getByRole("link", { name: "Pricing" }).click();
    await expect(page).toHaveURL(/\/pricing$/);
    await expect(page.getByText("Stripe Test Mode only")).toBeVisible();
    await expect(page.getByText("never create live charges")).toBeVisible();
  });

  test("keeps authentication fields labelled on a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back home" })).toBeVisible();
  });

  test("renders all portfolio plans without requiring credentials", async ({ page }) => {
    await page.goto("/pricing");

    await expect(page.getByRole("heading", { name: "A plan for every workspace" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Free" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Starter" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Growth" })).toBeVisible();
  });
});
