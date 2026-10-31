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

## Invoice and payment isolation

- composite foreign keys keep customers, invoices, items, and payments in one organization;
- forced RLS permits tenant reads and manager-only draft mutations;
- lifecycle and paid totals cannot be changed directly by runtime callers;
- payment recording locks the invoice, enforces idempotency, and rejects overpayments;
- payment rows cannot be updated or deleted by the runtime role;
- sent invoices cannot be edited or directly deleted;
- PDF downloads repeat authorization and return private, non-cacheable responses;
- audit metadata excludes contact data, notes, references, and financial amounts.

Cross-tenant integration tests use the non-owner runtime role and refuse to
count as executed when real database credentials and Auth identities are absent.

## Stripe subscription isolation

- only OWNER has `manage_billing`; ADMIN and MEMBER cannot read Stripe mappings;
- Checkout receives a server-mapped recurring Price ID, never a client price;
- only `sk_test_` keys are accepted and live-mode responses/events fail closed;
- webhook signatures cover the raw request body and expire after five minutes;
- event IDs are unique and older events cannot overwrite newer state;
- customer mappings are cross-checked before subscription changes;
- normal `authenticated` connections cannot execute webhook synchronization;
- a dedicated login inheriting only `tenantflow_stripe_webhook` is required.

## Analytics isolation

- OWNER, ADMIN, and MEMBER may read their workspace analytics;
- analytics has no write path and does not expand underlying table grants;
- all queries carry an organization predicate and run with authenticated RLS claims;
- date ranges are validated, bounded to 366 days, and remain SQL parameters;
- financial aggregates stay separated by currency;
- cross-tenant aggregate tests use the restricted non-`BYPASSRLS` runtime role.

## Deal isolation

- organization members may read deals, stages, and activity;
- only OWNER and ADMIN may create, update, move, close, note, or delete deals;
- composite keys prevent cross-tenant customer and stage relationships;
- a trigger validates optional assignees against current organization membership;
- outcome and close timestamps derive from immutable stage kinds;
- activity rows are append-only and MEMBER cannot insert notes;
- values use bounded integer minor units and metrics remain currency-separated.

## Expense and receipt isolation

- forced RLS allows members to read only their workspace categories and expenses;
- only OWNER and ADMIN may create, update, change status, attach receipts, or delete;
- composite keys reject categories from another organization;
- optimistic versions protect updates, status changes, and receipt metadata;
- payment dates are required only for paid or reimbursed expenses;
- private Storage paths start with the authorized organization UUID;
- Storage policies allow tenant reads and manager-only writes without a service-role key;
- receipt types are restricted to PDF/JPEG/PNG/WebP and files to 5 MB;
- downloads use 60-second signed URLs and responses are non-cacheable;
- audit metadata excludes amounts, vendor names, descriptions, filenames, and paths;
- reports exclude cancelled expenses and never combine currencies.

Client-supplied organization IDs and the selected-workspace cookie are untrusted. Server code validates their format and resolves membership under the authenticated PostgreSQL claim context before use. Unauthorized and nonexistent workspace routes share the same not-found behavior.

No service-role key is required by the application foundation. If privileged operations are added later, they must remain server-only and perform explicit authorization before bypassing RLS.

## FastAPI authentication and RLS

FastAPI accepts bearer tokens only after checking a rotating Supabase JWKS,
approved asymmetric algorithms, issuer, audience, expiry, issued-at time,
authenticated role, and UUID subject. The browser cannot supply an alternate
user identity to database dependencies.

Every SQLAlchemy request opens a transaction and uses `set_config(..., true)`
to set both Supabase-compatible JWT claim settings on that same pooled
connection. Transaction-local scope prevents identity leakage when the
connection returns to the pool. Organization paths still bind the verified
subject and requested organization in parameterized queries and return the
same not-found response for absent and unauthorized tenants.

Python team mutations call the existing security-definer functions with the
verified transaction identity. Those functions take organization-scoped locks,
protect the final owner, restrict ADMIN operations to MEMBER targets, and write
audit events in the same transaction. Ownership cannot be granted through the
generic role endpoint.

Invitation tokens contain 256 bits of randomness and are persisted only as
SHA-256 hashes. Acceptance delegates verified-email, expiry, recipient,
single-use, and existing-membership checks to the existing locked PostgreSQL
function. Plaintext links go only to the configured webhook or the
development-only gitignored outbox.

RLS integration assertions refuse to run through a superuser, `BYPASSRLS` role, or tenant-table owner. A separate migration connection is used only to arrange and remove fixtures; every tested read and mutation uses the restricted runtime role.
