# Architecture

TenantFlow currently uses a single Next.js App Router application. Server Actions and Route Handlers own server-side behavior; a standalone backend is not justified yet.

## Request flow

1. `src/proxy.ts` refreshes Supabase cookies and protects dashboard routes.
2. server-rendered protected pages call `supabase.auth.getUser()` rather than trusting unverified session data.
3. server actions validate input and invoke Supabase Auth through the server client.
4. future tenant data operations must verify membership and execute through `withUserContext` so PostgreSQL evaluates RLS with transaction-local identity claims.

The browser client receives only Supabase's project URL and publishable key. Direct PostgreSQL connections, migration credentials, and privileged operations stay on the server.

## Boundaries

- `src/lib/supabase/client.ts`: browser-safe Supabase client
- `src/lib/supabase/server.ts`: cookie-aware server Supabase client
- `src/db/client.ts`: server-only Drizzle connection and authenticated transaction wrapper
- `src/db/schema/`: typed database model
- `drizzle/`: reviewed, version-controlled SQL migrations

Organization onboarding and tenant-owned business entities are intentionally outside Day 1.
