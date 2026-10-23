# Security foundation

Supabase Auth is the identity provider. The browser receives only the project URL and publishable key. `DATABASE_URL` and any future privileged credentials remain server-only.

Tenant isolation uses three independent controls:

1. authenticated Supabase sessions;
2. server-side membership and role authorization; and
3. PostgreSQL RLS executed under a non-owner, non-`BYPASSRLS` role.

The initial migration forces RLS on tenant tables. Membership lookup helpers are `SECURITY DEFINER`, use a fixed empty search path, fully qualify referenced objects, and revoke public execution before granting it to `authenticated`.

## Organization roles

- OWNER can read and update the organization, manage roles, and delete the organization.
- ADMIN can read and update the organization, add non-owner memberships, and manage MEMBER records. ADMIN cannot modify existing ADMIN or OWNER records.
- MEMBER has read-only workspace access.

The second migration prevents membership identity changes and rejects demotion of the final OWNER. Application permission checks mirror these database rules; the database remains the final enforcement layer.

Client-supplied organization IDs and the selected-workspace cookie are untrusted. Server code validates their format and resolves membership under the authenticated PostgreSQL claim context before use. Unauthorized and nonexistent workspace routes share the same not-found behavior.

No service-role key is required by the application foundation. If privileged operations are added later, they must remain server-only and perform explicit authorization before bypassing RLS.

RLS integration assertions refuse to run through a superuser, `BYPASSRLS` role, or tenant-table owner. A separate migration connection is used only to arrange and remove fixtures; every tested read and mutation uses the restricted runtime role.
