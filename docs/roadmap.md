# Roadmap

## Day 1 — project foundation

- Next.js, TypeScript, Tailwind CSS, ESLint, and shadcn/ui
- Supabase authentication clients and flows
- Drizzle/PostgreSQL configuration
- initial identity and organization schema with RLS

## Day 2 — organization workspaces

- transactional organization creation and OWNER assignment
- reusable role-based server authorization
- authorized workspace listing and persistent selection
- onboarding and workspace UI states
- strengthened membership RLS migration
- Vitest, RLS integration, and Playwright test coverage

Live migration, RLS, and authentication verification remain environment-dependent and must not be marked passed until development credentials and test identities are configured.

## Day 3 — team management and audit logging

- secure expiring invitations and verified-email atomic acceptance
- OWNER/ADMIN team management and invitation revocation
- protected role changes, member removal, and ownership transfer
- concurrency-safe final-owner invariants
- organization settings and append-only tenant audit events
- Vitest, PostgreSQL RLS, and Playwright coverage

Live migration, RLS, authentication, and browser verification remain blocked
until development credentials and confirmed test identities are configured.

## Recommended Day 4

1. provision separate migration and non-BYPASSRLS runtime roles and apply all migrations;
2. run live authentication, RLS, invitation-delivery, and Playwright verification;
3. add CI with an isolated Supabase test project and disposable identities;
4. add audit-log pagination, filters, retention policy, and actor display names;
5. add invitation resend with rotation and delivery observability;
6. define the first tenant-owned customer model only after isolation is proven end to end.

Day 4 live integration remains pending because development Supabase credentials
and test identities have not been configured.

## Day 5 — customer management

- tenant-owned customer schema, indexes, forced RLS, and immutable identity fields
- authorized create, read, update, and delete operations with optimistic concurrency
- search, lifecycle filtering, deterministic sorting, and bounded pagination
- responsive list, create, view, edit, and deletion-confirmation workflows
- append-only customer activity audit events
- Vitest, environment-gated RLS, and Playwright coverage

## Day 6 — invoice management and payment tracking

- tenant-owned invoice, line-item, and manual-payment schema with forced RLS
- secure draft CRUD and same-tenant customer association
- integer-minor-unit calculations, tax, discounts, balances, and lifecycle states
- responsive invoice and payment workflows
- authorized PDF downloads and append-only financial activity events
- Vitest, credential-gated PostgreSQL RLS, and Playwright coverage

## Day 7 — Stripe subscription billing

- tenant-isolated subscription plans, Stripe mappings, and subscription state
- owner-only test-mode Checkout and Customer Portal lifecycle management
- signed, idempotent webhook synchronization and out-of-order protection
- pricing and billing UI with plan capacity enforcement
- credential-gated RLS, webhook, and Playwright coverage

## Day 8 — business dashboard analytics

- tenant-scoped customer, invoice, payment, balance, and overdue metrics
- monthly invoiced and paid series separated by currency
- customer growth, invoice status distribution, and recent activity
- responsive date-filtered dashboard with honest empty and error states
- MEMBER read-only analytics backed by existing forced RLS
- Vitest, credential-gated RLS, and Playwright coverage

## Day 9 — sales pipeline and deal management

- tenant-isolated stages, deals, assignment, notes, and activity history
- responsive Kanban with authorized drag-and-drop transitions
- WON/LOST outcomes and optimistic concurrency
- customer and team-member relationship enforcement
- currency-separated sales metrics integrated into the dashboard
- Vitest, credential-gated RLS, and Playwright coverage

## Day 10 â€” expense management

- tenant-isolated categories and expenses with forced RLS
- secure CRUD, payment status tracking, and optimistic concurrency
- search, category/status/payment filters, sorting, and pagination
- responsive list, form, detail, status, and deletion workflows
- private validated receipts with signed download URLs
- transactional audit events and currency-separated spending analytics
- Vitest, credential-gated PostgreSQL RLS, and Playwright coverage

## Day 11 — Python backend foundation

- modular FastAPI service with typed configuration and structured errors
- SQLAlchemy/psycopg access through a validated restricted runtime role
- strict rotating Supabase JWT verification
- reusable authenticated and organization authorization dependencies
- transaction-local RLS identity on pooled connections
- health, current-user, and read-only organization endpoints
- server-side Next.js adapter for one existing screen
- Pytest, Ruff, mypy, Docker, and local-development documentation

Live Auth and cross-tenant database verification remain blocked until a
restricted `DATABASE_URL` and disposable development identities are supplied.
Drizzle remains the only migration authority.

## Day 12 — Python organization and team management

- authenticated organization creation, listing, and updates
- reusable Python OWNER, ADMIN, and MEMBER authorization
- team reads, role changes, removal, and secure ownership transfer
- expiring hashed invitations with acceptance and revocation
- existing locked PostgreSQL functions and audit triggers reused unchanged
- server-only Next.js adapters with TypeScript fallback behavior
- Pytest and credential-gated cross-tenant lifecycle coverage

Live tenant-isolation and browser verification remain required before the
Python feature branches can merge into `main`.

## Recommended Day 13

## Day 13 — FastAPI integration and security verification

- centralized gitignored live-test configuration
- restricted-role, migration, and identity readiness diagnostics
- expired, malformed, missing, and unauthorized JWT HTTP coverage
- organization and invitation REST contract tests
- Next.js server adapter integration tests
- post-commit invitation delivery ordering
- sanitized structured validation and unexpected-error responses

Live PostgreSQL RLS and Playwright execution still require the restricted
runtime login and disposable confirmed accounts described in the security
documentation. Skipped checks do not satisfy the merge gate.

## Day 14 — Python customer management migration

- SQLAlchemy mapping to the existing Drizzle-managed customer table
- Pydantic customer validation and typed API responses
- customer CRUD plus bounded search, filtering, sorting, and pagination
- OWNER/ADMIN writes, MEMBER reads, and tenant-qualified statements under RLS
- optimistic version conflicts and existing transactional audit triggers
- server-only Next.js adapter with the TypeScript implementation retained as fallback
- Pytest, Vitest, credential-gated RLS, and existing Playwright customer coverage

Live RLS and browser execution still require a restricted runtime role and
disposable confirmed identities. Until those checks run, this feature remains
on its feature branch rather than being automatically merged.

## Day 15 — Python invoice and payment management

- SQLAlchemy mappings for existing invoices, line items, and immutable payments
- Pydantic validation and integer-minor-unit total calculation
- tenant-authorized invoice CRUD, lifecycle transitions, and private PDFs
- serialized numbering plus transactional, idempotent partial/full payments
- server-only Next.js integration with the Drizzle fallback preserved
- Pytest, Vitest, API contract, credential-gated RLS, and Playwright coverage

Live RLS and browser verification remain mandatory before merging this security
boundary to `main`. Missing disposable identities or a restricted runtime role
is reported as a skip and leaves the feature branch unmerged.

## Day 16 — Python sales pipeline migration

- SQLAlchemy mappings for existing stages, deals, and append-only activity
- validated deal CRUD, paginated filters, sorting, and tenant-safe form options
- secure stage transitions, WON/LOST outcomes, notes, and activity history
- currency-separated pipeline, won-revenue, stage, and conversion metrics
- server-only Kanban, form, detail, mutation, and dashboard integration
- Pytest, API contract, Vitest, credential-gated RLS, and Playwright coverage

Live RLS and browser verification remain mandatory before merging this security
boundary to `main`. Missing restricted-role credentials or disposable users is
reported as a skip rather than treated as successful verification.

## Day 17 — Python expense management migration

- SQLAlchemy mappings for existing expense and category tables, with no new migration
- authorized CRUD, category management, bounded listing, and explicit status transitions
- private receipt upload, signed download, and deletion through user-scoped Storage RLS
- currency-separated monthly, category, total, and paid-spend analytics
- server-only Next.js screens, actions, receipts, and dashboard adapter with Drizzle fallback
- Pytest, API contract, receipt-security, Vitest, credential-gated RLS, and Playwright coverage

Live RLS, Storage, and browser verification remain mandatory before merging
this security boundary to `main`. Missing credentials are reported as skips.

## Day 18 — Python Stripe billing and dashboard analytics migration

- SQLAlchemy mappings for existing plan, customer, subscription, and webhook tables
- OWNER-only Test Mode Checkout and Portal using server-controlled Price IDs
- raw-body HMAC verification and the existing idempotent, ordered webhook RPC
- explicit TypeScript/Python/disabled processor selection with rollback support
- tenant RLS dashboard metrics, financial series, insights, sales, and expenses
- server-only billing/dashboard adapters with the verified TypeScript fallback
- Pytest, Vitest, contract, webhook-security, credential-gated RLS/Stripe, and Playwright coverage

Live Stripe sandbox, RLS, and browser verification remain mandatory before
merging this security boundary to `main`.

## Day 19 — full-stack integration and bug fixing

- audited server-only adapters across every migrated business module
- aligned FastAPI request/response contracts and fail-closed mutation behavior
- preserved TypeScript only as an explicitly selected rollback implementation
- expanded unit, contract, and authenticated browser coverage

## Day 20 — live integration and security verification preparation

- restricted runtime, migration, webhook, and disposable-identity diagnostics
- exact migration-count and confirmed Auth identity readiness checks
- live RLS, Stripe Test Mode, and authenticated Playwright runbook
- explicit rule that unavailable or skipped security checks block merging

## Day 21 — Docker, CI/CD, and deployment preparation

- multi-stage non-root Next.js and FastAPI images with health checks
- hardened local Compose networking and placeholder-only configuration
- GitHub Actions for Ruff, mypy, Pytest, ESLint, TypeScript, Vitest, builds,
  dependency auditing, and production image verification
- manually approved live-security workflow that fails on missing or skipped checks
- Vercel frontend and Render FastAPI deployment manifests
- structured request logging, request correlation, secure headers, and deployment
  documentation

Live RLS, Stripe sandbox, and authenticated Playwright checks remain mandatory
before merging or promoting these deployment changes.
