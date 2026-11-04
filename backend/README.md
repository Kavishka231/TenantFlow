# TenantFlow FastAPI backend

This service is TenantFlow's incremental Python backend. It verifies Supabase
access tokens, establishes transaction-local PostgreSQL RLS identity, and
serves organization, team, invitation, customer, and audit endpoints. Drizzle in
`../frontend` remains the only migration source of truth.

## Local development

Python 3.12 through 3.14 is supported.

```bash
python -m venv .venv
# PowerShell: .venv\Scripts\Activate.ps1
# POSIX: source .venv/bin/activate
python -m pip install -e ".[dev]"
cp .env.example .env.local
uvicorn app.main:create_app --factory --reload --port 8000
```

`DATABASE_URL` must use a restricted login that inherits `authenticated`, does
not own tenant tables, and is neither superuser nor `BYPASSRLS`. Startup fails
closed if this invariant is not met. Never use `MIGRATION_DATABASE_URL` here.

Set `FASTAPI_INTERNAL_URL=http://127.0.0.1:8000` in `frontend/.env.local` to
route supported server-side operations through this service. The Next.js server forwards the
Supabase access token; it is never exposed through a public environment value.

## Endpoints

- `GET /api/v1/health`
- `GET /api/v1/auth/me`
- `GET /api/v1/organizations`
- `GET /api/v1/organizations/{organization_id}`
- `POST /api/v1/organizations`
- `PATCH /api/v1/organizations/{organization_id}`
- `GET /api/v1/organizations/{organization_id}/team`
- membership role, removal, and ownership-transfer endpoints beneath `/team`
- invitation create/revoke endpoints beneath `/team/invitations`
- `POST /api/v1/invitations/accept`
- `GET /api/v1/organizations/{organization_id}/team/audit`
- customer create/list/detail/update/delete endpoints beneath
  `/api/v1/organizations/{organization_id}/customers`
- invoice CRUD, lifecycle, payment, customer-option, and PDF endpoints beneath
  `/api/v1/organizations/{organization_id}/invoices`
- deal CRUD, pipeline, options, transitions, notes, and metrics beneath
  `/api/v1/organizations/{organization_id}/deals`

Customer list queries accept `q`, `status`, an allowlisted `sort`, `page`, and
`page_size` of 10, 25, or 50. OWNER and ADMIN can mutate customer records;
MEMBER is read-only. Update and delete requests must include the current
positive `version` and return `customer_version_conflict` when stale.

Invoice endpoints map the existing Drizzle tables and call the existing
PostgreSQL lifecycle/payment functions. They do not create schemas. MEMBER can
read invoices and PDFs; OWNER and ADMIN can manage drafts, transitions, and
payments. Next.js uses these endpoints only when `FASTAPI_INTERNAL_URL` is set.

Deal endpoints map the existing stages, deals, and activity tables. PostgreSQL
RLS and triggers remain authoritative for tenant relationships, assignees,
outcomes, optimistic versions, close timestamps, and activity events. Sales
aggregates use integer minor units and group independently by currency.

Interactive API docs are available at `/docs` outside production.

## Verification

```bash
ruff check app tests
mypy app tests
pytest
tenantflow-readiness
```

The live RLS test additionally requires `DATABASE_URL`,
`MIGRATION_DATABASE_URL`, `SUPABASE_URL`, and all four `RLS_TEST_*_ID` values.
The identities must be disposable confirmed users in
the development project. Missing values produce an explicit skip, not a pass.

Invitation delivery uses the existing server webhook contract. Configure
`INVITATION_DELIVERY_WEBHOOK_URL` and a secret of at least 16 characters, or
enable `INVITATION_DEV_OUTBOX` outside production. Only SHA-256 token hashes are
stored; the plaintext acceptance URL is handed directly to the delivery path.

## Live integration setup

Copy `.env.test.example` to the gitignored `.env.test.local`. Create four
disposable, confirmed users through Supabase Auth and use their UUIDs for the
four `RLS_TEST_*_ID` values. Never insert rows directly into `auth.users`.

The runtime database login must inherit `authenticated` while remaining a
non-owner without `SUPERUSER` or `BYPASSRLS`:

```sql
CREATE ROLE tenantflow_runtime_login LOGIN PASSWORD 'generated-development-secret'
  NOSUPERUSER NOBYPASSRLS INHERIT;
GRANT authenticated TO tenantflow_runtime_login;
```

Use that login only for `DATABASE_URL`. Keep the migration connection separate.
`tenantflow-readiness` prints only booleans and counts; it validates the role,
database connections, migration count, and presence of all four profiles
without displaying credentials or identity values.
