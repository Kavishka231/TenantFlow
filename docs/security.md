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

Day 3 strengthens this boundary with organization-scoped advisory locks and
last-owner checks on updates and deletes. OWNER may change non-owner roles,
remove teammates, and transfer ownership. ADMIN may invite and remove MEMBERs,
but cannot grant ADMIN/OWNER, modify managers, or transfer ownership.

## Invitation security

- invitation tokens use 256 bits of cryptographic randomness;
- only SHA-256 token hashes are stored;
- tokens expire after seven days and are single-use;
- acceptance locks the invitation and verifies that the current Auth email is confirmed and matches;
- revoked, expired, replayed, cross-account, and existing-member acceptance is rejected;
- OWNER may invite ADMIN or MEMBER, while ADMIN may invite MEMBER only;
- plaintext URLs go only to the server webhook or opt-in gitignored development outbox.

## Audit integrity

Audit events are inserted by security-definer triggers in the same transaction
as the underlying operation. Runtime users cannot insert, update, or delete
audit rows. Only organization OWNER and ADMIN roles may read their tenant's
events, and metadata excludes invitation tokens and email addresses.

## Customer isolation

- every customer belongs to one immutable organization;
- forced RLS allows organization members to read customer records;
- only OWNER and ADMIN may insert, update, or delete customers;
- server actions independently enforce matching organization permissions;
- customer mutations qualify by both customer ID and organization ID;
- stale updates and deletes are rejected through positive version checks;
- database triggers prevent customer ID, organization, creator, and creation timestamp changes;
- customer audit metadata contains IDs and state changes, not contact details or notes.

Cross-tenant integration tests use the non-owner runtime role and refuse to
count as executed when real database credentials and Auth identities are absent.

Client-supplied organization IDs and the selected-workspace cookie are untrusted. Server code validates their format and resolves membership under the authenticated PostgreSQL claim context before use. Unauthorized and nonexistent workspace routes share the same not-found behavior.

No service-role key is required by the application foundation. If privileged operations are added later, they must remain server-only and perform explicit authorization before bypassing RLS.

RLS integration assertions refuse to run through a superuser, `BYPASSRLS` role, or tenant-table owner. A separate migration connection is used only to arrange and remove fixtures; every tested read and mutation uses the restricted runtime role.
