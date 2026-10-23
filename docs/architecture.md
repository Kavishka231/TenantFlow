# Architecture

TenantFlow currently uses a single Next.js App Router application. Server Actions and Route Handlers own server-side behavior; a standalone backend is not justified yet.

## Request flow

1. `src/proxy.ts` refreshes Supabase cookies and protects dashboard routes.
2. server-rendered protected pages call `supabase.auth.getUser()` rather than trusting unverified session data.
3. server actions validate input and invoke Supabase Auth through the server client.
4. organization operations verify membership and role permissions before using tenant context;
5. direct PostgreSQL operations execute through `withUserContext` so RLS evaluates transaction-local identity claims.

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

Tenant-owned customer and billing entities remain outside Day 3.
