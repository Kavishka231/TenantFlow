import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

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
const hasLiveConfiguration =
  Object.values(liveConfiguration).every(Boolean) &&
  process.env.INVITATION_DEV_OUTBOX === "true";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function findInvitationUrl(email: string, organizationName: string) {
  const outbox = path.join(process.cwd(), ".tenantflow-dev", "invitations");

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const files = await readdir(outbox).catch(() => [] as string[]);
    const candidates = await Promise.all(
      files.map(async (file) => ({
        file,
        modifiedAt: (await stat(path.join(outbox, file))).mtimeMs,
      })),
    );

    for (const candidate of candidates.sort(
      (left, right) => right.modifiedAt - left.modifiedAt,
    )) {
      const payload = JSON.parse(
        await readFile(path.join(outbox, candidate.file), "utf8"),
      ) as { acceptUrl?: string; email?: string; organizationName?: string };

      if (
        payload.email === email.toLowerCase() &&
        payload.organizationName === organizationName &&
        payload.acceptUrl
      ) {
        return payload.acceptUrl;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("The development invitation was not delivered to the outbox.");
}

test.describe("team invitations and membership management", () => {
  test.skip(
    !hasLiveConfiguration,
    "Live Supabase, migrated database, two confirmed accounts, and INVITATION_DEV_OUTBOX=true are required.",
  );

  test("invites, accepts once, authorizes team access, changes role, and removes", async ({
    page,
  }) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const organizationName = `E2E Team ${suffix}`;

    await login(
      page,
      liveConfiguration.ownerEmail!,
      liveConfiguration.ownerPassword!,
    );
    await page.goto("/organizations/new");
    await page.getByLabel("Organization name").fill(organizationName);
    await page.getByLabel("Workspace URL").fill(`e2e-team-${suffix}`);
    await page.getByRole("button", { name: "Create workspace" }).click();
    await page.getByRole("link", { name: "Manage team" }).click();

    const teamUrl = page.url();
    await page
      .getByLabel("Email address")
      .fill(liveConfiguration.outsiderEmail!);
    await page.getByRole("button", { name: "Send invitation" }).click();
    await expect(page.getByText("Invitation sent securely.")).toBeVisible();

    const invitationUrl = await findInvitationUrl(
      liveConfiguration.outsiderEmail!,
      organizationName,
    );
    const invitationPath = new URL(invitationUrl).pathname + new URL(invitationUrl).search;

    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Log out" }).click();
    await login(
      page,
      liveConfiguration.outsiderEmail!,
      liveConfiguration.outsiderPassword!,
    );
    await page.goto(invitationPath);
    await page.getByRole("button", { name: "Accept invitation" }).click();
    await expect(page.getByRole("heading", { name: organizationName })).toBeVisible();

    await page.goto(invitationPath);
    await page.getByRole("button", { name: "Accept invitation" }).click();
    await expect(page.getByRole("alert")).toContainText("invalid");

    const unauthorizedResponse = await page.goto(teamUrl);
    expect(unauthorizedResponse?.status()).toBe(404);

    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Log out" }).click();
    await login(
      page,
      liveConfiguration.ownerEmail!,
      liveConfiguration.ownerPassword!,
    );
    await page.goto(teamUrl);

    const managedMember = page.locator("form").filter({
      has: page.getByRole("button", { name: "Save role" }),
    });
    await managedMember.getByRole("combobox").selectOption("admin");
    await managedMember.getByRole("button", { name: "Save role" }).click();
    await expect(page.getByRole("status")).toContainText("updated");

    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByRole("status")).toContainText("updated");
  });
});
