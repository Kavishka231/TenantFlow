# Database foundation

TenantFlow uses version-controlled Drizzle schemas and SQL migrations in `frontend/drizzle/`.

## Initial model

- `profiles` is a one-to-one application profile for `auth.users`. Its primary key is the Supabase user ID.
- `organizations` stores tenant workspaces. Slugs are globally unique and constrained to lowercase URL-safe values.
- `organization_members` joins profiles to organizations with an `owner`, `admin`, or `member` role. Its composite primary key prevents duplicate memberships.

Every table has Row-Level Security enabled and forced. Profiles are self-accessible. Organization and membership access is resolved through security-definer helper functions with a fixed search path, preventing recursive RLS evaluation.

## Connection roles

`DATABASE_URL` is server-only. Runtime connections must use a dedicated login role that inherits the Supabase `authenticated` role so the migration policies and grants apply, while remaining a non-owner. It must:

- does not own the tables;
- does not have `BYPASSRLS` or superuser privileges;
- has only the grants needed by the application; and
- is tested with the same request claim context used in production.

Drizzle does not provide tenant isolation. Application queries must run through `withUserContext`, which opens a transaction and sets transaction-local Supabase-compatible JWT claims. Authorization checks remain required for every mutation.

`MIGRATION_DATABASE_URL` is a separate server-only DDL credential used only by Drizzle Kit. It must never be available to the browser or normal application runtime.
