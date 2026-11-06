# Live verification runbook

Use a disposable Supabase development project and Stripe Test Mode only. Never
point these checks at production data. Keep every value below in gitignored
`.env.test.local` files and never paste passwords, JWTs, webhook secrets, or
connection strings into issues, screenshots, traces, or CI logs.

## 1. Database roles

Create a runtime login that inherits `authenticated` but owns no application
table and has neither `SUPERUSER` nor `BYPASSRLS`. Set its connection string as
`DATABASE_URL`. Keep the existing DDL-capable connection separate as
`MIGRATION_DATABASE_URL`; it is used only to arrange and clean disposable
fixtures.

Create a separate Stripe webhook login with `NOSUPERUSER NOBYPASSRLS INHERIT`,
grant it only `tenantflow_stripe_webhook`, and set its connection string as
`STRIPE_WEBHOOK_DATABASE_URL`. It must not inherit `authenticated` or own any
public table.

## 2. Disposable Supabase identities

In Supabase Auth, create four unique development-only users for OWNER, ADMIN,
MEMBER, and OUTSIDER. Confirm each email through the normal Auth flow. Copy only
their UUIDs into `backend/.env.test.local`:

```dotenv
DATABASE_URL=postgresql://restricted_runtime:password@host/postgres?sslmode=require
MIGRATION_DATABASE_URL=postgresql://migration_user:password@host/postgres?sslmode=require
SUPABASE_URL=https://project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=publishable-key
RLS_TEST_OWNER_ID=owner-uuid
RLS_TEST_ADMIN_ID=admin-uuid
RLS_TEST_MEMBER_ID=member-uuid
RLS_TEST_OUTSIDER_ID=outsider-uuid
```

The RLS suites create two randomized organizations, assign the four roles, and
remove the organizations in cleanup hooks. Do not manually reuse real business
organizations. Put the same database URLs and UUIDs in
`frontend/.env.test.local`. Add the OWNER and OUTSIDER email/password pairs as
`E2E_USER_*` and `E2E_SECOND_USER_*`; the browser suite uses those accounts for
same-tenant and cross-tenant scenarios.

## 3. Stripe Test Mode

In the Stripe test dashboard, create recurring monthly USD Prices matching the
catalog: Starter at 2900 minor units and Growth at 7900 minor units. Configure
the test Customer Portal for subscription updates and cancellation, then set:

```dotenv
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_GROWTH_PRICE_ID=price_...
STRIPE_WEBHOOK_DATABASE_URL=postgresql://dedicated_webhook_login:password@host/postgres?sslmode=require
STRIPE_WEBHOOK_PROCESSOR=python
```

Use one processor value in both services. For local events, run Stripe CLI in
Test Mode and forward to `http://127.0.0.1:3100/api/stripe/webhook`; copy its
signing secret privately into the test environment and do not retain CLI output.
Use Stripe's documented test card `4242 4242 4242 4242` with any future expiry
and CVC. Never enter a real card.

## 4. Full-stack browser environment

Set these values in `frontend/.env.test.local` in addition to the shared test
values:

```dotenv
TENANTFLOW_BACKEND=fastapi
FASTAPI_INTERNAL_URL=http://127.0.0.1:8000
E2E_BASE_URL=http://127.0.0.1:3100
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3100
NEXT_PUBLIC_SUPABASE_URL=https://project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=publishable-key
INVITATION_DEV_OUTBOX=true
```

Allow the local callback URL in Supabase Auth. Playwright starts both Next.js
and FastAPI, waits for both health endpoints, and disables authenticated trace
archives. Install Chromium once with `npx playwright install chromium`.

## 5. Verification order

From `backend`, run `tenantflow-readiness` first. Continue only when it reports
an exact migration match, four confirmed Auth identities and profiles, a safe
runtime role, and a safe webhook role. Then run the backend unit and integration
suites. From `frontend`, run `npm run test:rls`, `npm run test:e2e`, and the
remaining lint, type, unit, build, and Drizzle checks.

Skipped RLS, Stripe, or Playwright scenarios are blockers, not passes. After a
failed run, verify fixture cleanup using the migration connection before
rerunning. Delete the four disposable Auth users when verification is complete.
