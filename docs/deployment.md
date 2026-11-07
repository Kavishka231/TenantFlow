# Deployment

TenantFlow deploys the Next.js application and FastAPI service independently,
with Supabase remaining the managed Auth, PostgreSQL, and Storage provider. The
checked-in target configuration uses Vercel for `frontend/` and a Render Docker
web service for `backend/`. Equivalent container hosts are acceptable if they
provide HTTPS, health checks, and secret environment variables.

## Deployment topology

```text
Browser --HTTPS--> Vercel Next.js --HTTPS + Supabase JWT--> FastAPI
   |                       |                                  |
   +---- Supabase Auth ----+                                  +-- restricted PostgreSQL role
                                                              +-- user-scoped Supabase Storage
Stripe Test Mode --signed raw event--> Next.js webhook proxy --+-- dedicated webhook role
```

The browser never receives a database URL, Stripe secret, webhook secret, or
FastAPI credential. `FASTAPI_INTERNAL_URL` is a server-only name retained from
local development; on Vercel it must be the FastAPI service's public HTTPS URL.

## Local containers

Copy the placeholder template to the gitignored local file and replace every
required value with development-only credentials:

```bash
cp compose.env.example .env.compose.local
docker compose --env-file .env.compose.local up --build
```

Next.js is available at `http://127.0.0.1:3000` and FastAPI health at
`http://127.0.0.1:8000/api/v1/health`. The frontend reaches FastAPI over the
private Compose network. Both host ports bind to loopback, both containers run
without root or Linux capabilities, and startup waits for backend health.

Use `docker compose --env-file .env.compose.local config --quiet` before
starting services. Do not add migration credentials to the Compose runtime
file and never copy a real `.env` file into an image.

## FastAPI on Render

Create a Blueprint from `render.yaml`. Before its first deployment, provide all
variables marked `sync: false` in the Render dashboard:

- `DATABASE_URL`: restricted runtime login only;
- `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`;
- `CORS_ORIGINS` and `FRONTEND_APP_URL`: the exact Vercel HTTPS origin;
- Stripe Test Mode key, signing secret, and the two recurring Price IDs;
- `STRIPE_WEBHOOK_DATABASE_URL`: the dedicated webhook login; and
- `STRIPE_WEBHOOK_PROCESSOR=python` for the normal deployment.

Do not configure `MIGRATION_DATABASE_URL` or a Supabase service-role key. The
container binds to the platform-provided `PORT`, validates the runtime database
role at startup, and exposes `/api/v1/health` for deployment health checks.

## Next.js on Vercel

Import the repository as a Vercel project with Root Directory `frontend` and
Node.js 22. `frontend/vercel.json` fixes the framework and
`TENANTFLOW_BACKEND=fastapi`. Configure these environment variables separately
for Preview and Production as appropriate:

- `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
- restricted `DATABASE_URL` for the explicit TypeScript rollback path;
- `FASTAPI_INTERNAL_URL=https://api.example.com`;
- all Stripe Test Mode values and `STRIPE_WEBHOOK_PROCESSOR=python`; and
- the production invitation delivery URL and secret, if invitations are used.

Never set `MIGRATION_DATABASE_URL`, `INVITATION_DEV_OUTBOX=true`, a service-role
key, or live-mode Stripe keys. Add the Vercel application and callback URLs to
the Supabase Auth allowlist.

## HTTPS, CORS, and webhooks

Production FastAPI startup rejects non-HTTPS frontend and CORS origins. Use the
exact Vercel origin; wildcard authenticated CORS is rejected. Next.js forwards
the current Supabase access token server-to-server, and FastAPI verifies issuer,
audience, lifetime, role, and subject before opening an RLS transaction.

Configure one Stripe Test Mode endpoint at
`https://app.example.com/api/stripe/webhook`. With both services set to
`STRIPE_WEBHOOK_PROCESSOR=python`, Next.js preserves the raw body and signature
and forwards the event to FastAPI. Do not also register the FastAPI URL for the
same events.

For rollback, first stop Stripe event delivery or set both processors to
`disabled`. Then set the Next.js processor to `typescript`, give only Next.js
the dedicated webhook connection, redeploy, and enable the single Next.js
endpoint. Switching `TENANTFLOW_BACKEND=typescript` is a separate, deliberate
application rollback; a failed FastAPI request never triggers it automatically.

## Release sequence

1. Apply reviewed Drizzle migrations through a separate controlled migration
   job; application containers never migrate the database.
2. Run the normal CI and manually approved live-security workflow.
3. Deploy FastAPI and confirm its health endpoint over HTTPS.
4. Deploy Next.js in FastAPI mode and verify login plus a read-only workspace.
5. Configure the single Stripe Test Mode endpoint and send a signed test event.
6. Exercise an OWNER mutation, MEMBER read, and cross-tenant denial before
   promoting the release.

If live RLS, authenticated browser, or Stripe sandbox checks are unavailable or
skipped, the release is not security-verified and must not be merged or promoted.
