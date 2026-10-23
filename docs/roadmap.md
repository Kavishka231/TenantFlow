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

## Recommended Day 3

1. provision and verify development database roles and apply both migrations;
2. run the live RLS and Playwright suites, then address any environment-specific findings;
3. implement secure team invitations with expiring, single-use tokens;
4. add OWNER-only ownership transfer and protected member removal workflows;
5. add organization settings with optimistic concurrency and audit events;
6. establish CI with disposable Supabase test infrastructure before tenant-owned business modules.

Customer management, invoices, Stripe, and other business modules should follow only after tenant isolation is proven end to end.
