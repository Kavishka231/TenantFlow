# Roadmap

## Day 1 — completed locally

- project and UI foundation
- Supabase authentication integration
- Drizzle/PostgreSQL configuration
- initial identity and organization schema with RLS
- registration, login, logout, callback, protected route, and unit tests

Live migration and authentication verification remain environment-dependent and are not marked complete without development credentials.

## Recommended Day 2

1. provision dedicated development migration/runtime roles and run the migration;
2. add database integration tests proving cross-tenant denial under the runtime role;
3. verify email confirmation, session refresh, logout, and protected redirects against Supabase;
4. implement transactional organization onboarding with the registering user as owner;
5. add membership authorization helpers and tests before any tenant-owned business feature;
6. add Playwright authentication smoke tests with isolated test users.

Customer management, invoices, Stripe, and other business modules should follow only after tenant isolation is proven end to end.
