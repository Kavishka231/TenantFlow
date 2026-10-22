# Security foundation

Supabase Auth is the identity provider. The browser receives only the project URL and publishable key. `DATABASE_URL` and any future privileged credentials remain server-only.

Tenant isolation uses three independent controls:

1. authenticated Supabase sessions;
2. server-side membership and role authorization; and
3. PostgreSQL RLS executed under a non-owner, non-`BYPASSRLS` role.

The initial migration forces RLS on tenant tables. Membership lookup helpers are `SECURITY DEFINER`, use a fixed empty search path, fully qualify referenced objects, and revoke public execution before granting it to `authenticated`.

No service-role key is required by the application foundation. If privileged operations are added later, they must remain server-only and perform explicit authorization before bypassing RLS.
