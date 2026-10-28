# TenantFlow

TenantFlow is a production-oriented, multi-tenant SaaS foundation built with Next.js, Supabase Auth, PostgreSQL Row-Level Security (RLS), and Drizzle ORM.

## Current status

Day 9 adds a tenant-isolated sales pipeline and deal management. Development migrations are applied through `0022`; restricted-runtime RLS, browser, and live Stripe verification remain credential-dependent:

- Next.js App Router, TypeScript, Tailwind CSS, ESLint, and shadcn/ui
- responsive public, authentication, and protected dashboard layouts
- Supabase browser/server clients and cookie-based session refresh
- registration, login, logout, email-confirmation callback, and protected routes
- Drizzle configuration and a version-controlled PostgreSQL migration
- profiles, organizations, and organization memberships with constraints, indexes, triggers, grants, and RLS policies
- unit tests for authentication validation and safe redirects
- atomic organization creation with automatic OWNER membership
- reusable OWNER, ADMIN, and MEMBER authorization checks
- authorized workspace listing and HTTP-only workspace selection
- organization onboarding, selection, loading, empty, and error states
- strengthened membership RLS policies and environment-gated integration tests
- environment-gated Playwright authentication and workspace workflows
- expiring, single-use invitations stored only as SHA-256 hashes
- verified-email invitation acceptance with replay protection
- OWNER/ADMIN team management with database-enforced role boundaries
- serialized role changes, member removal, and ownership transfer
- last-owner protection for membership updates and deletes
- organization settings and tenant-isolated, append-only audit events
- environment-gated RLS and Playwright coverage for team workflows
- customer records with name, email, phone, company, address, status, and notes
- manager-only customer creation, updates, and deletion with optimistic version checks
- member-readable customer lists with search, status filters, sorting, and pagination
- responsive customer list, create, detail, edit, and delete-confirmation pages
- customer activity audit events and credential-gated cross-tenant RLS tests
- organization-scoped invoices, ordered line items, and immutable manual payment records
- sequential workspace invoice numbers and same-tenant customer constraints
- integer-minor-unit totals, discounts, basis-point tax, balances, and lifecycle statuses
- transactional, idempotent payment recording with overpayment prevention
- responsive invoice CRUD, lifecycle, payment-history, and PDF workflows
- append-only invoice/payment audit events and credential-gated security tests
- organization subscription plans, Stripe customer mappings, and forced-RLS billing records
- owner-only Checkout and Customer Portal sessions using server-owned test Price IDs
- signed, idempotent webhook synchronization through a dedicated database role
- pricing and billing dashboards with transactional customer and invoice plan limits
- credential-gated billing RLS and Playwright coverage
- date-filtered customer, invoice, payment, outstanding, and overdue metrics
- currency-separated monthly invoice and payment analytics
- customer growth, effective invoice status, and real recent-activity charts
- responsive analytics dashboard with loading, error, and empty states
- MEMBER-readable analytics enforced through authorization and PostgreSQL RLS
- organization pipeline stages and customer-linked deals with integer minor-unit values
- OWNER/ADMIN deal management with MEMBER read-only access
- responsive drag-and-drop Kanban pipeline and secure stage transitions
- WON/LOST outcomes, notes, assignment, close dates, and append-only activity history
- currency-separated pipeline value and won-revenue dashboard metrics

TenantFlow subscription billing is separate from customers' manually tracked business invoices. Stripe operates in Test Mode only; no real payments are accepted.

## Repository structure

```text
TenantFlow/
├── docs/                  # Architecture, database, security, and roadmap
├── frontend/              # Next.js application and database migrations
├── .gitignore
└── README.md
```

## Requirements

- Node.js 22 LTS or compatible
- npm 11 or compatible
- a Supabase development project
- separate PostgreSQL runtime and migration roles

## Local setup

```bash
cd frontend
npm install
cp .env.example .env.local
```

Configure `frontend/.env.local` with real development values:

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
DATABASE_URL=postgresql://application_user:password@host:5432/postgres?sslmode=require
MIGRATION_DATABASE_URL=postgresql://migration_user:password@host:5432/postgres?sslmode=require
STRIPE_SECRET_KEY=sk_test_replace_me
STRIPE_WEBHOOK_SECRET=whsec_replace_me
STRIPE_STARTER_PRICE_ID=price_replace_me
STRIPE_GROWTH_PRICE_ID=price_replace_me
STRIPE_WEBHOOK_DATABASE_URL=postgresql://stripe_webhook_user:password@host:5432/postgres?sslmode=require
```

Only the three `NEXT_PUBLIC_` values are browser-safe. Both database URLs are server-only. Do not use a table owner, superuser, or `BYPASSRLS` role for `DATABASE_URL`. Do not expose a Supabase service-role key.

For webhooks, create a dedicated login (with a generated password) and grant it
only the capability created by migration `0019`:

```sql
CREATE ROLE tenantflow_stripe_webhook_login LOGIN PASSWORD 'generated-secret'
  NOSUPERUSER NOBYPASSRLS INHERIT;
GRANT tenantflow_stripe_webhook TO tenantflow_stripe_webhook_login;
```

Set its connection string as `STRIPE_WEBHOOK_DATABASE_URL`. In the Stripe Test
Mode dashboard, create recurring USD Prices matching Starter ($29) and Growth
($79), configure the Customer Portal for plan changes/cancellation, and point a
webhook endpoint at `/api/stripe/webhook` for `customer.subscription.created`,
`updated`, `deleted`, `paused`, and `resumed` events.

In Supabase Auth URL configuration, set the local Site URL to `http://localhost:3000` and allow `http://localhost:3000/auth/callback` as a redirect URL. Keep email/password sign-ups enabled if registration is required.

Apply the reviewed migration to a development database:

```bash
npm run db:migrate
```

Invitation delivery is server-only. Configure both
`INVITATION_DELIVERY_WEBHOOK_URL` and `INVITATION_DELIVERY_WEBHOOK_SECRET` for
an HTTPS mail-delivery adapter. During local development only,
`INVITATION_DEV_OUTBOX=true` writes acceptance URLs to the gitignored
`frontend/.tenantflow-dev/invitations/` directory. Never use that outbox in
production.

The runtime login role must inherit Supabase's `authenticated` role without owning the migrated tables. Test RLS using that runtime role and transaction-local JWT claims; see [database.md](docs/database.md) and [security.md](docs/security.md).

Start the application:

```bash
npm run dev
```

## Verification commands

```bash
npm run lint
npm run typecheck
npm run test:run
npm run test:rls
npm run test:e2e
npm run build
npm run db:check
```

`db:check` and migration generation need `MIGRATION_DATABASE_URL` present because the Drizzle configuration deliberately refuses to invent a database target. RLS integration tests require four real Supabase Auth test identities and both database roles in `.env.test.local`. Playwright requires two confirmed disposable test accounts and `npx playwright install chromium`; team invitation E2E coverage additionally requires the development outbox. Applying migrations and exercising live authentication require real development credentials.

## Security model

Authentication alone is not tenant isolation. Every tenant operation must combine:

1. a verified Supabase user;
2. explicit server-side membership and role checks; and
3. PostgreSQL RLS under a non-owner, non-`BYPASSRLS` runtime role.

Direct Drizzle work must use the transaction wrapper in `frontend/src/db/client.ts`, which sets transaction-local Supabase-compatible JWT claims. Organization identifiers from forms, routes, and cookies are always reauthorized against membership. Drizzle and the selected-workspace cookie do not automatically enforce RLS or tenant boundaries.

Invitation creation, acceptance, membership mutations, and ownership transfer
also execute through reviewed PostgreSQL functions. Those functions validate
`auth.uid()`, lock sensitive rows or ownership boundaries, and do not grant
callers direct access to plaintext tokens or audit mutations.

Customer identifiers and organization identifiers from routes and forms are
both untrusted. Every customer request reauthorizes workspace membership,
qualifies database operations by organization, and executes with forced RLS.
OWNER and ADMIN may mutate customers; MEMBER has read-only customer access.

Invoice, customer, and organization identifiers are all reauthorized. Composite
foreign keys enforce that invoice customers, items, and payments remain in the
same tenant. OWNER and ADMIN manage invoices and record manual payments; MEMBER
is read-only. Payment insertion is available only through a locked database
function that validates the caller and outstanding balance.

Analytics never combines different currencies into one financial total and does
not generate placeholder business data. Queries include explicit organization
predicates and execute under transaction-local RLS claims; MEMBER access remains
read-only.

Deal customer, stage, and assignee identities are validated inside the same
organization boundary. Removing a team member safely unassigns their deals.
Deal and sales aggregates never combine different currencies.

Only an organization OWNER can manage subscription billing. Checkout uses
server-selected Price IDs. Stripe webhooks are verified against the raw body
before a dedicated `tenantflow_stripe_webhook` database capability synchronizes
state; normal authenticated connections cannot execute that function.

## Documentation

- [Architecture](docs/architecture.md)
- [Database](docs/database.md)
- [Security](docs/security.md)
- [Roadmap](docs/roadmap.md)

No license has been selected. Do not assume permission to redistribute the project.
