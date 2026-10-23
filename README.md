# TenantFlow

TenantFlow is a production-oriented, multi-tenant SaaS foundation built with Next.js, Supabase Auth, PostgreSQL Row-Level Security (RLS), and Drizzle ORM.

## Current status

Day 2 implements organization workspaces on top of the Day 1 foundation:

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

Customer management, invoices, Stripe billing, and team invitations are not implemented.

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
```

Only the three `NEXT_PUBLIC_` values are browser-safe. Both database URLs are server-only. Do not use a table owner, superuser, or `BYPASSRLS` role for `DATABASE_URL`. Do not expose a Supabase service-role key.

In Supabase Auth URL configuration, set the local Site URL to `http://localhost:3000` and allow `http://localhost:3000/auth/callback` as a redirect URL. Keep email/password sign-ups enabled if registration is required.

Apply the reviewed migration to a development database:

```bash
npm run db:migrate
```

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

`db:check` and migration generation need `MIGRATION_DATABASE_URL` present because the Drizzle configuration deliberately refuses to invent a database target. RLS integration tests require four real Supabase Auth test identities and both database roles in `.env.test.local`. Playwright requires two confirmed disposable test accounts and `npx playwright install chromium`. Applying migrations and exercising live authentication require real development credentials.

## Security model

Authentication alone is not tenant isolation. Every tenant operation must combine:

1. a verified Supabase user;
2. explicit server-side membership and role checks; and
3. PostgreSQL RLS under a non-owner, non-`BYPASSRLS` runtime role.

Direct Drizzle work must use the transaction wrapper in `frontend/src/db/client.ts`, which sets transaction-local Supabase-compatible JWT claims. Organization identifiers from forms, routes, and cookies are always reauthorized against membership. Drizzle and the selected-workspace cookie do not automatically enforce RLS or tenant boundaries.

## Documentation

- [Architecture](docs/architecture.md)
- [Database](docs/database.md)
- [Security](docs/security.md)
- [Roadmap](docs/roadmap.md)

No license has been selected. Do not assume permission to redistribute the project.
