# Portfolio demo setup

The fixture in [`demo-data.json`](demo-data.json) contains fictional development-only data. Its `.example` email domains, reserved `555` phone numbers, company names, and financial records do not identify real people or customers. Never import it into a production database.

TenantFlow intentionally does not provide a privileged bulk-seed path. Create the portfolio data through the same authenticated application workflows that real users exercise; this preserves server authorization, PostgreSQL RLS, audit events, invoice calculations, and plan limits.

## Prerequisites

1. Configure a disposable Supabase development project using the main setup instructions.
2. Apply the reviewed Drizzle migrations with the migration role.
3. Start FastAPI and Next.js with `TENANTFLOW_BACKEND=fastapi`.
4. Register one disposable, confirmed Supabase Auth user. Do not use a personal or production identity.
5. Keep Stripe in Test Mode. Stripe is optional for the core demo.

## Reproducible walkthrough

Use the values in `demo-data.json` in this order:

1. Create the `Northstar Studio Demo` organization.
2. Add the three fictional customers.
3. Create the listed deals and place them in the indicated pipeline stages.
4. Create the draft invoice and its two line items. Keep it as a draft unless lifecycle behavior is part of the demonstration.
5. Add `Software` and `Office` expense categories if they are not already present, then record the two fictional expenses.
6. Open the dashboard and select a date range that includes the records.

For a team-management demonstration, create a second disposable Supabase test identity and invite it as a MEMBER. Delete both identities and the demo organization after the presentation if the development project is not retained.

## Safe reset

Delete the demo organization through a controlled development cleanup process using migration credentials. Do not add cleanup credentials to either application runtime. Organization-scoped foreign keys cascade the disposable business records, while production records remain out of scope.

The fixture deliberately contains no passwords, tokens, database URLs, Stripe identifiers, receipt files, or live customer information.
