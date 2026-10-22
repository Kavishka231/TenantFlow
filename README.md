# TenantFlow — Multi-Tenant SaaS Business Management Platform

TenantFlow is a modern business management platform that enables multiple organizations to manage customers, invoices, team members, and subscriptions through secure, independent workspaces.

Built with a multi-tenant architecture, TenantFlow allows multiple organizations to use a shared application while keeping their business data isolated through server-side authorization and PostgreSQL Row-Level Security (RLS).

## Project Structure

```text
tenantflow/
├── README.md
├── docs/
│   ├── architecture.md
│   ├── security.md
│   ├── database.md
│   └── roadmap.md
├── frontend/
├── backend/                  # Optional standalone backend
├── .gitignore
└── .env.example
```

### Directory Overview

| Directory/File | Description |
|---|---|
| `frontend/` | Next.js, TypeScript, Tailwind CSS, and shadcn/ui application |
| `backend/` | Optional independent API, background worker, or backend service |
| `docs/` | Architecture, security, database, and roadmap documentation |
| `.env.example` | Example environment variable names without real credentials |
| `.gitignore` | Files and directories excluded from Git |
| `README.md` | Project overview, setup instructions, and development guide |

**Architecture decision:** The initial version can use Next.js Route Handlers and Server Actions for server-side functionality. A separate backend is not required unless TenantFlow needs independently deployed APIs, workers, or services. Keep the `backend/` directory only if it is part of the planned architecture.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js App Router |
| Programming Language | TypeScript |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Authentication | Supabase Auth |
| Database | Supabase PostgreSQL |
| ORM | Drizzle ORM |
| Database Security | PostgreSQL Row-Level Security |
| Payments and Billing | Stripe Billing and Checkout |
| Hosting | Vercel |
| Background Jobs | Inngest |
| Email | Resend |
| File Storage | Supabase Storage |
| Validation | Zod |
| Unit and Integration Testing | Vitest |
| End-to-End Testing | Playwright |

## Core Features

### MVP Scope

The initial MVP aims to provide:

- User registration, login, and authentication
- Organization creation and workspace switching
- Team invitations and role-based access control (RBAC)
- Tenant-isolated customer management
- Invoice creation and payment tracking
- Subscription management with Stripe
- Business dashboard and essential metrics
- Audit logging for important business operations
- Secure organization membership checks and tenant data isolation

### Planned Enhancements

- Sales and deal management
- Expense tracking
- Product and service management
- Advanced analytics and reports
- Platform administration
- Automated notifications and business workflows

Features should be marked as implemented only after they are developed and tested.

## Multi-Tenant Architecture

TenantFlow uses a shared application and PostgreSQL database to serve multiple organizations. Each organization has its own workspace, members, permissions, and business records.

### Tenant Isolation

Every tenant-owned record must be associated with an organization identifier, such as `organization_id`.

The application must enforce tenant isolation through:

1. **Authentication:** Identify the signed-in user.
2. **Authorization:** Verify the user's organization membership and permissions.
3. **Database security:** Apply PostgreSQL Row-Level Security policies to tenant-owned tables.
4. **Validation:** Check ownership and access permissions on every protected operation.
5. **Testing:** Verify that users cannot read or modify data belonging to another organization.

RLS policies must be configured and tested using the appropriate database role and user context. When using Drizzle with a direct PostgreSQL connection, ensure that the database queries execute under a security context that correctly enforces the intended tenant restrictions.

Never expose privileged database credentials, such as a Supabase service-role key, to the browser. Privileged operations must remain on the server and must include explicit authorization checks.

## Getting Started

### Prerequisites

Install the following tools and create the required accounts:

- Node.js LTS
- npm
- Git
- A Supabase project
- A Stripe account for payment and billing development

Accounts for Vercel, Resend, and Inngest can be configured when their respective features are implemented.

### 1. Clone the Repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd TenantFlow
```

Replace `<YOUR_REPOSITORY_URL>` with your actual Git repository URL.

If your repository uses a different directory name, enter that directory instead.

### 2. Install Frontend Dependencies

If the Next.js application is located inside `frontend/`, run:

```bash
cd frontend
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file inside `frontend/` and configure the variables required by your selected services.

Example:

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

DATABASE_URL=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

RESEND_API_KEY=
```

Add other variables when required by implemented features, such as Inngest credentials.

**Security requirements:**

- Use the Supabase publishable key for browser-safe Supabase operations.
- Keep `DATABASE_URL`, Stripe secret keys, webhook secrets, and email API keys server-side.
- Never expose privileged credentials through `NEXT_PUBLIC_` variables.
- Never commit `.env.local` or real credentials to Git.
- Keep `.env.example` updated with variable names and safe placeholder values only.

The environment variable names must match the configuration used by the application.

### 4. Start the Development Server

From the `frontend/` directory, run:

```bash
npm run dev
```

Open the following address in your browser:

```text
http://localhost:3000
```

Ensure the required environment variables are configured before using features that depend on Supabase, Stripe, or other external services.

### 5. Database Development

Use Drizzle ORM to define database schemas and manage version-controlled migrations.

Typical database commands may include:

```bash
npm run db:generate
npm run db:migrate
```

These commands must be configured in `frontend/package.json` and connected to the appropriate Drizzle configuration. Their availability depends on the scripts implemented in the project.

Before applying migrations to production, review the generated SQL and test the changes in a development environment.

## Development Guidelines

- Use TypeScript throughout the application.
- Build reusable, accessible, and maintainable UI components.
- Validate user input on the server using Zod or equivalent validation.
- Verify organization membership and permissions for every protected operation.
- Enforce tenant isolation with PostgreSQL RLS and server-side authorization.
- Never trust organization identifiers supplied by the client without verifying access.
- Keep payment processing, webhook verification, and privileged operations on the server.
- Use database migrations for schema changes.
- Implement appropriate error handling and secure logging.
- Write tests for authentication, authorization, billing, and cross-tenant isolation.
- Never commit passwords, API keys, database credentials, or production secrets.

## Documentation

Project documentation is maintained in the `docs/` directory.

| File | Purpose |
|---|---|
| `docs/architecture.md` | Application architecture, components, and request flow |
| `docs/security.md` | Authentication, authorization, RLS, and tenant isolation |
| `docs/database.md` | Database schema, relationships, indexes, and migrations |
| `docs/roadmap.md` | MVP milestones and planned enhancements |

Update the documentation when important architectural or security decisions change.

## Project Status

**Status:** In Development

The initial objective is to deliver a secure, reliable MVP with authentication, organization workspaces, team management, customer management, invoicing, subscription billing, and a business dashboard.

The project will expand with additional business management features as the core platform becomes stable.

## License

No license has been selected yet.

Choose and add an appropriate license before distributing TenantFlow publicly. Until a license is added, do not assume that others have permission to reuse, modify, or redistribute the project.