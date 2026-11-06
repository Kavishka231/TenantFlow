# Architecture

TenantFlow uses Next.js App Router with FastAPI as its intended application backend. Existing TypeScript implementations remain available as an explicitly selected rollback path. Organization, team, customer, invoice, sales-pipeline, expense, billing, and analytics screens use Python APIs through server-only adapters.

## Request flow

1. `src/proxy.ts` refreshes Supabase cookies and protects dashboard routes.
2. server-rendered protected pages call `supabase.auth.getUser()` rather than trusting unverified session data.
3. server actions validate input and invoke Supabase Auth through the server client.
4. organization operations verify membership and role permissions before using tenant context;
5. direct PostgreSQL operations execute through `withUserContext` so RLS evaluates transaction-local identity claims.
6. in `TENANTFLOW_BACKEND=fastapi` mode, server-only adapters forward the current Supabase access token to `FASTAPI_INTERNAL_URL`; FastAPI independently verifies it and sets the same transaction-local RLS context;
7. `TENANTFLOW_BACKEND=typescript` is the only condition that selects the rollback implementation. Python errors never fall through to a second mutation.

The browser client receives only Supabase's project URL and publishable key. Direct PostgreSQL connections, migration credentials, and privileged operations stay on the server.

## Boundaries

- `src/lib/supabase/client.ts`: browser-safe Supabase client
- `src/lib/supabase/server.ts`: cookie-aware server Supabase client
- `src/db/client.ts`: server-only Drizzle connection and authenticated transaction wrapper
- `src/db/schema/`: typed database model
- `drizzle/`: reviewed, version-controlled SQL migrations
- `src/lib/organizations/authorization.ts`: membership and role authorization boundary
- `src/lib/organizations/workspace.ts`: authorized workspace resolution and secure preference cookie
- `src/lib/team/invitations.ts`: cryptographic invitation creation and delivery handoff
- `src/lib/team/acceptance.ts`: single-use invitation acceptance boundary
- `src/lib/team/members.ts`: membership and ownership database operations
- `src/lib/team/audit.ts`: tenant-authorized audit reads
- `src/lib/customers/validation.ts`: customer input and mutation validation
- `src/lib/customers/mutations.ts`: tenant-qualified customer writes
- `src/lib/customers/list.ts`: TypeScript fallback for bounded customer search, filtering, sorting, and pagination
- `src/lib/backend/customers.ts`: server-only FastAPI customer adapter and response boundary
- `src/lib/backend/client.ts`: fail-closed backend selection, bearer forwarding, correlation IDs, and structured errors
- `src/lib/backend/invoices.ts`: invoice API adapter, validation boundary, and Drizzle fallback
- `src/lib/backend/deals.ts`: pipeline, deal, metrics, and mutation API adapter with fallbacks
- `src/lib/invoices/mutations.ts`: transactional draft and lifecycle operations
- `src/lib/invoices/money.ts`: integer-minor-unit financial calculations
- `src/lib/invoices/list.ts`: bounded invoice querying and pagination
- `src/lib/billing/stripe-api.ts`: test-mode Stripe REST adapter and server-owned prices
- `src/lib/billing/webhook.ts`: raw-body signature verification and event validation
- `src/lib/billing/entitlements.ts`: transaction-locked plan capacity enforcement
- `src/lib/analytics/metrics.ts`: tenant-scoped dashboard totals
- `src/lib/analytics/financial.ts`: currency-separated monthly financial series
- `src/lib/analytics/insights.ts`: growth, status, and recent activity queries
- `src/lib/deals/mutations.ts`: tenant-qualified deal writes and transitions
- `src/lib/deals/data.ts`: pipeline, detail, options, and activity reads
- `src/lib/deals/metrics.ts`: currency-safe sales dashboard aggregates
- `src/lib/expenses/mutations.ts`: tenant-qualified expense and receipt metadata writes
- `src/lib/expenses/list.ts`: bounded expense search, filters, sorting, and pagination
- `src/lib/expenses/reports.ts`: currency-separated spending analytics
- `src/lib/expenses/receipts.ts`: private receipt validation and object-path rules
- `src/lib/backend/expenses.ts`: validated server-only FastAPI adapter with the
  Drizzle and direct Storage fallback
- `../backend/app/auth/`: strict Supabase JWT verification and authenticated dependencies
- `../backend/app/db/`: restricted SQLAlchemy sessions and transaction-local RLS context
- `../backend/app/organizations/`: Python membership authorization and read services
- `../backend/app/team/`: team mutations, invitations, delivery, and audit reads
- `../backend/app/customers/`: existing-table mappings, schemas, and tenant-qualified customer services
- `../backend/app/deals/`: existing-table deal mappings, pipeline services, metrics, and validation

## Python migration boundary

FastAPI does not receive migration credentials and does not use Alembic.
Drizzle migrations remain the schema source of truth. The Python connection is
validated at startup and rejected if it owns tenant tables, bypasses RLS, is a
superuser, or does not inherit `authenticated`. No existing TypeScript business
logic is removed merely because a Python endpoint exists.

Live Playwright configuration starts Next.js and FastAPI as separate local
processes when `TENANTFLOW_BACKEND=fastapi`. The Python process inherits only
the test environment, uses the restricted `DATABASE_URL`, and must report a
healthy `/api/v1/health` endpoint before browser scenarios begin.

Organization creation inserts the workspace, OWNER membership, pipeline stages,
and expense categories in one authenticated transaction. Team mutations call
the existing PostgreSQL functions rather than recreating locking and role
rules in Python. Invitation creation commits the hash and audit event before
external delivery; delivery failure leaves a revocable pending invitation.

## Workspace selection

The selected organization UUID is stored in an HTTP-only, SameSite=Lax cookie. It is a preference, not proof of authorization. Each request lists the authenticated user's memberships under RLS and accepts the cookie only when it matches that authorized set. Forged, stale, or cross-tenant values fall back safely.

Organization creation pre-generates the UUID and inserts both the organization and OWNER membership in one database transaction. This avoids exposing a partially initialized tenant and avoids relying on SELECT visibility before membership exists.

## Team management

Invitation plaintext exists only long enough to reach the configured server-side
delivery adapter. PostgreSQL stores a SHA-256 hash. Acceptance derives identity
and confirmed email from Supabase Auth inside a locked database function; the
browser cannot choose the resulting organization or role.

Role changes, removal, and ownership transfer use organization-scoped advisory
transaction locks. Audit triggers run in the same transaction as each business
change. The application role can read authorized audit events but has no audit
insert, update, or delete grant.

## Customer management

Customer pages are nested beneath an authorized organization route. Every read
and mutation carries both customer and organization identity, and the database
enforces the same tenant relationship through forced RLS. Members can read;
owners and administrators can create, update, and delete. Updates and deletes
include a version predicate so stale forms cannot silently overwrite newer work.

Search parameters are parsed into bounded values before queries are built.
Search values remain SQL parameters, sorting uses an allowlist, and pagination
is limited to 10, 25, or 50 records.

FastAPI maps the existing `customers` table without creating a second schema or
an Alembic migration history. Reads and writes run in the same restricted,
transaction-local RLS session used by organization authorization. Existing
database triggers remain responsible for version increments, immutable tenant
identity, and transaction-coupled audit events. The Next.js adapter translates
Python snake-case responses into the existing UI contract and falls back to
Drizzle only when `TENANTFLOW_BACKEND=typescript` is explicitly configured.

## Invoice management

Invoices are tenant-owned aggregates containing ordered line items and immutable
manual payment records. Creation locks the organization invoice-number boundary;
updates replace draft items atomically with optimistic version checks. Sending,
cancellation, and payment recording use PostgreSQL functions that lock the
invoice and validate the authenticated organization role.

Money values are integer minor units and tax rates are integer basis points.
Effective overdue status is derived from the due date. PDF downloads are
generated only after server-side workspace authorization and are never cached.

## Subscription billing

Checkout and Customer Portal sessions are created only after OWNER authorization.
Stripe is authoritative for lifecycle state. Signed subscription events enter
through one Next.js route and exactly one configured processor. In `typescript`
mode the established handler uses the dedicated database capability; in
`python` mode the route forwards the untouched body and signature to FastAPI.
Both processors call the same idempotent PostgreSQL function, so rollback is a
configuration change rather than a data migration. Plan limits
are checked inside customer and invoice creation transactions.

## Dashboard analytics

The dashboard validates a bounded date range, explicitly authorizes the active
organization, and executes read-only aggregates through either `withUserContext`
or the equivalent FastAPI RLS transaction.
Financial series are grouped by ISO currency before presentation; no exchange
rate conversion or cross-currency summation is implied. Recent activity is
derived from tenant-readable business tables so MEMBER access stays read-only.

## Sales pipeline

Deals reference customers and stages through composite tenant keys. Assignees
are validated by a database trigger against organization membership, and member
removal unassigns deals without blocking the team workflow. The browser's drag
payload is untrusted; every transition repeats server authorization and executes
under RLS with optimistic version checks.

## Expense management

Expenses reference categories through composite organization keys and use
integer minor units. Status and payment-date consistency is enforced by Zod and
database constraints. Important mutations emit audit rows in the same database
transaction. Receipts are stored outside PostgreSQL in the private
`expense-receipts` bucket; the database stores only validated metadata and an
organization-prefixed object path. Downloads use short-lived signed URLs after
fresh authentication and workspace authorization.

The Python expense module maps these existing tables with SQLAlchemy and keeps
all writes inside the restricted RLS transaction. Its Storage gateway forwards
the user's bearer token to the existing private bucket and never uses a
service-role credential. FastAPI mode requires the server-side
`FASTAPI_INTERNAL_URL`; removing that URL fails closed. Rollback requires the
explicit `TENANTFLOW_BACKEND=typescript` setting.
