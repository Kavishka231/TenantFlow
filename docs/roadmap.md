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

## Recommended Day 8

1. provision the dedicated webhook login and restricted runtime role in CI;
2. run Stripe CLI webhook and Checkout suites against an isolated test project;
3. add metered usage reporting only if product requirements demand it;
4. add billing notification delivery and reconciliation observability;
5. design grace-period and dunning policy around Stripe's authoritative status;
6. add organization billing contacts without mixing them with invoice customers.
