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

## Deal and pipeline endpoints

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| `GET` / `POST` | `/organizations/{organization_id}/deals` | MEMBER+ / OWNER/ADMIN | Filter/page or create deals |
| `GET` / `PATCH` / `DELETE` | `/organizations/{organization_id}/deals/{deal_id}` | MEMBER+ / OWNER/ADMIN | Read or mutate a current deal version |
| `GET` | `/organizations/{organization_id}/deals/pipeline` | MEMBER+ | Read stages and Kanban cards |
| `GET` | `/organizations/{organization_id}/deals/options` | MEMBER+ | Read tenant-safe form options |
| `GET` | `/organizations/{organization_id}/deals/metrics` | MEMBER+ | Read currency-separated sales metrics |
| `POST` | `/organizations/{organization_id}/deals/{deal_id}/transition` | OWNER/ADMIN | Change stage and synchronize outcome |
| `POST` | `/organizations/{organization_id}/deals/{deal_id}/notes` | OWNER/ADMIN | Append a deal note |

Deal listing supports bounded search, stage, outcome, assignee, customer, and
currency filters; allowlisted sorting; and `page_size=10|25|50`. Values are
integer minor units and aggregates never combine currencies. Updates,
transitions, and deletes require the current positive `version`; stale writes
return HTTP 409 with `deal_conflict`. PostgreSQL validates tenant customer,
stage, and assignee relationships, derives open/WON/LOST outcomes, timestamps
closures, increments versions, and appends activity history.

| Method | Expense path | Role | Purpose |
| --- | --- | --- | --- |
| `GET/POST` | `/organizations/{organization_id}/expenses` | MEMBER+ / OWNER,ADMIN | List or create expenses |
| `GET/PATCH/DELETE` | `/organizations/{organization_id}/expenses/{expense_id}` | MEMBER+ / OWNER,ADMIN | Read, edit, or delete an expense |
| `GET/POST` | `/organizations/{organization_id}/expenses/categories` | MEMBER+ / OWNER,ADMIN | List or create categories |
| `PATCH/DELETE` | `/organizations/{organization_id}/expenses/categories/{category_id}` | OWNER/ADMIN | Manage a category |
| `POST` | `/organizations/{organization_id}/expenses/{expense_id}/transition` | OWNER/ADMIN | Change payment status with version checking |
| `PUT/GET/DELETE` | `/organizations/{organization_id}/expenses/{expense_id}/receipt` | OWNER,ADMIN / MEMBER+ / OWNER,ADMIN | Manage a private receipt |
| `GET` | `/organizations/{organization_id}/expenses/metrics` | MEMBER+ | Read currency-separated spending metrics |

Receipt uploads use a raw body with `Content-Type`, `X-Receipt-Name`, and
`X-Expense-Version` headers. Supported types are PDF, JPEG, PNG, and WebP; the
maximum size is 5 MB. The download response contains a 60-second signed URL.

## Billing and analytics endpoints

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| `GET` | `/organizations/{organization_id}/billing/plans` | OWNER | List active server plans |
| `GET` | `/organizations/{organization_id}/billing` | OWNER | Read Stripe customer/subscription state |
| `POST` | `/organizations/{organization_id}/billing/checkout` | OWNER | Create Test Mode Checkout with a server Price ID |
| `POST` | `/organizations/{organization_id}/billing/portal` | OWNER | Create a hosted Customer Portal session |
| `GET` | `/organizations/{organization_id}/analytics/dashboard` | MEMBER+ | Read customer, invoice, payment, and financial analytics |
| `POST` | `/stripe/webhook` | Stripe signature | Process subscription lifecycle events in Python mode |

The webhook endpoint verifies the signature over the unmodified request bytes.
It is active only when `STRIPE_WEBHOOK_PROCESSOR=python`; otherwise it fails
closed. Existing PostgreSQL functions provide event replay protection,
customer/organization matching, and event-created ordering.

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
