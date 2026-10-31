# TenantFlow FastAPI backend

This service is TenantFlow's incremental Python backend. It verifies Supabase
access tokens, establishes transaction-local PostgreSQL RLS identity, and
serves organization, team, invitation, and audit endpoints. Drizzle in
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
route the workspace list through this service. The Next.js server forwards the
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

Interactive API docs are available at `/docs` outside production.

## Verification

```bash
ruff check app tests
mypy app tests
pytest
```

The live RLS test additionally requires `DATABASE_URL`,
`MIGRATION_DATABASE_URL`, `SUPABASE_URL`, and all four `RLS_TEST_*_ID` values.
The identities must be disposable confirmed users in
the development project. Missing values produce an explicit skip, not a pass.

Invitation delivery uses the existing server webhook contract. Configure
`INVITATION_DELIVERY_WEBHOOK_URL` and a secret of at least 16 characters, or
enable `INVITATION_DEV_OUTBOX` outside production. Only SHA-256 token hashes are
stored; the plaintext acceptance URL is handed directly to the delivery path.
