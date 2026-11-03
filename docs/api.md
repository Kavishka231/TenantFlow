# API

FastAPI is mounted at `/api/v1`. OpenAPI is available at `/docs` outside the
production environment. All protected endpoints require a Supabase access token
in `Authorization: Bearer <token>`; organization IDs are routing inputs, not
authorization proof.

## Customer endpoints

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| `GET` | `/organizations/{organization_id}/customers` | MEMBER+ | Search and page customers |
| `POST` | `/organizations/{organization_id}/customers` | OWNER/ADMIN | Create a customer |
| `GET` | `/organizations/{organization_id}/customers/{customer_id}` | MEMBER+ | Read one customer |
| `PATCH` | `/organizations/{organization_id}/customers/{customer_id}` | OWNER/ADMIN | Update the current version |
| `DELETE` | `/organizations/{organization_id}/customers/{customer_id}` | OWNER/ADMIN | Delete the current version |

The list endpoint supports `q`, `status=lead|active|inactive`,
`sort=name_asc|name_desc|newest|oldest|recently_updated`, `page`, and
`page_size=10|25|50`. Sorting always includes the customer UUID as a stable
tie-breaker.

Create and update bodies accept `name`, `email`, `phone`, `company`, `address`,
`status`, and `notes`. Update and delete bodies also require a positive
`version`. A stale write returns HTTP 409 with `customer_version_conflict`; a
plan-capacity rejection returns HTTP 409 with `customer_plan_limit`.

## Invoice endpoints

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| `GET` / `POST` | `/organizations/{organization_id}/invoices` | MEMBER+ / OWNER/ADMIN | Page or create invoices |
| `GET` / `PATCH` / `DELETE` | `/organizations/{organization_id}/invoices/{invoice_id}` | MEMBER+ / OWNER/ADMIN | Read or mutate a current draft |
| `POST` | `/organizations/{organization_id}/invoices/{invoice_id}/send` | OWNER/ADMIN | Send the current draft version |
| `POST` | `/organizations/{organization_id}/invoices/{invoice_id}/cancel` | OWNER/ADMIN | Cancel an eligible current version |
| `POST` | `/organizations/{organization_id}/invoices/{invoice_id}/payments` | OWNER/ADMIN | Record an idempotent payment |
| `GET` | `/organizations/{organization_id}/invoices/{invoice_id}/pdf` | MEMBER+ | Download a private PDF |

Invoice inputs use integer minor units (`unit_price_minor`, `discount_minor`,
and `amount_minor`). Totals are calculated by the API and checked again by
PostgreSQL constraints. Payment requests require a UUID `idempotency_key`;
replaying the same invoice and amount returns the original immutable payment,
while key reuse with different payment data and overpayments return HTTP 409.
Draft writes and lifecycle requests carry a positive `version` to reject stale
updates. The database remains authoritative for serialized numbering, lifecycle
transitions, payment locking, RLS, and audit events.

Error responses use the shared envelope:

```json
{
  "error": { "code": "stable_code", "message": "Safe message" },
  "request_id": "request-correlation-id"
}
```

Drizzle remains the migration source of truth. FastAPI uses the restricted
runtime role and transaction-local authenticated claims; it never receives the
migration database URL.
