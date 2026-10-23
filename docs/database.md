# Database foundation

TenantFlow uses version-controlled Drizzle schemas and SQL migrations in `frontend/drizzle/`.

## Initial model

- `profiles` is a one-to-one application profile for `auth.users`. Its primary key is the Supabase user ID.
- `organizations` stores tenant workspaces. Slugs are globally unique and constrained to lowercase URL-safe values.
- `organization_members` joins profiles to organizations with an `owner`, `admin`, or `member` role. Its composite primary key prevents duplicate memberships.
- `organization_invitations` stores normalized recipients, intended non-owner roles, expiry and terminal state, and unique SHA-256 token hashes.
- `audit_events` stores append-only tenant events with actor, event type, timestamp, and non-sensitive JSON metadata.

Every table has Row-Level Security enabled and forced. Profiles are self-accessible. Organization and membership access is resolved through security-definer helper functions with a fixed search path, preventing recursive RLS evaluation.

Migration `0001_strengthen_organization_rls.sql` aligns membership policies with the application role matrix. ADMIN can add non-owner memberships and manage MEMBER records, but cannot modify existing ADMIN or OWNER records. Membership identities are immutable, and the final OWNER cannot be demoted.

Migrations `0002` through `0005` add invitations, atomic verified-email
acceptance, serialized membership and ownership functions, settings audit
triggers, and tenant-isolated audit reads. The runtime role has no direct
invitation mutation grant and no audit mutation grant.

## Connection roles

`DATABASE_URL` is server-only. Runtime connections must use a dedicated login role that inherits the Supabase `authenticated` role so the migration policies and grants apply, while remaining a non-owner. It must:

- does not own the tables;
- does not have `BYPASSRLS` or superuser privileges;
- has only the grants needed by the application; and
- is tested with the same request claim context used in production.

Drizzle does not provide tenant isolation. Application queries must run through `withUserContext`, which opens a transaction and sets transaction-local Supabase-compatible JWT claims. Authorization checks remain required for every mutation.

`MIGRATION_DATABASE_URL` is a separate server-only DDL credential used only by Drizzle Kit. It must never be available to the browser or normal application runtime.

## Isolation testing

`npm run test:rls` uses `DATABASE_URL` for all assertions. It first verifies that this role is not a superuser, does not have `BYPASSRLS`, does not own tenant tables, and inherits `authenticated`. Fixture setup and cleanup use `MIGRATION_DATABASE_URL`; tested operations never do.

Four confirmed Supabase test-user IDs are required in `.env.test.local`: OWNER, ADMIN, MEMBER, and an outsider. The suites cover cross-tenant reads, unauthorized updates/deletes, invitation role restrictions, verified-email acceptance and replay, audit tampering, ownership transfer, and the final-owner invariant.
