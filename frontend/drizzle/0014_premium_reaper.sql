CREATE TYPE "public"."subscription_status" AS ENUM('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused');--> statement-breakpoint
CREATE TABLE "organization_subscriptions" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"plan_id" uuid NOT NULL,
	"stripe_customer_id" varchar(255) NOT NULL,
	"stripe_subscription_id" varchar(255) NOT NULL,
	"stripe_price_id" varchar(255) NOT NULL,
	"status" "subscription_status" NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"stripe_event_created_at" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_subscriptions_stripe_subscription_unique" UNIQUE("stripe_subscription_id"),
	CONSTRAINT "organization_subscriptions_customer_format" CHECK ("organization_subscriptions"."stripe_customer_id" ~ '^cus_[A-Za-z0-9]+$'),
	CONSTRAINT "organization_subscriptions_subscription_format" CHECK ("organization_subscriptions"."stripe_subscription_id" ~ '^sub_[A-Za-z0-9]+$'),
	CONSTRAINT "organization_subscriptions_price_format" CHECK ("organization_subscriptions"."stripe_price_id" ~ '^price_[A-Za-z0-9]+$'),
	CONSTRAINT "organization_subscriptions_event_created_nonnegative" CHECK ("organization_subscriptions"."stripe_event_created_at" >= 0)
);
--> statement-breakpoint
ALTER TABLE "organization_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stripe_customers" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"stripe_customer_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_customers_customer_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "stripe_customers_id_format" CHECK ("stripe_customers"."stripe_customer_id" ~ '^cus_[A-Za-z0-9]+$')
);
--> statement-breakpoint
ALTER TABLE "stripe_customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stripe_webhook_events" (
	"stripe_event_id" varchar(255) PRIMARY KEY NOT NULL,
	"event_type" varchar(120) NOT NULL,
	"organization_id" uuid,
	"payload_sha256" varchar(64) NOT NULL,
	"stripe_created_at" bigint NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_webhook_events_id_format" CHECK ("stripe_webhook_events"."stripe_event_id" ~ '^evt_[A-Za-z0-9]+$'),
	CONSTRAINT "stripe_webhook_events_hash_format" CHECK ("stripe_webhook_events"."payload_sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "stripe_webhook_events_created_nonnegative" CHECK ("stripe_webhook_events"."stripe_created_at" >= 0)
);
--> statement-breakpoint
ALTER TABLE "stripe_webhook_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" varchar(32) NOT NULL,
	"name" varchar(80) NOT NULL,
	"description" varchar(500) NOT NULL,
	"monthly_price_minor" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"limits" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_key_unique" UNIQUE("key"),
	CONSTRAINT "subscription_plans_key_format" CHECK ("subscription_plans"."key" ~ '^[a-z][a-z0-9_]*$'),
	CONSTRAINT "subscription_plans_price_nonnegative" CHECK ("subscription_plans"."monthly_price_minor" >= 0),
	CONSTRAINT "subscription_plans_currency_format" CHECK ("subscription_plans"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "subscription_plans_sort_positive" CHECK ("subscription_plans"."sort_order" > 0)
);
--> statement-breakpoint
ALTER TABLE "subscription_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_customers" ADD CONSTRAINT "stripe_customers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_webhook_events" ADD CONSTRAINT "stripe_webhook_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_subscriptions_status_idx" ON "organization_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "organization_subscriptions_customer_idx" ON "organization_subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "stripe_webhook_events_organization_processed_idx" ON "stripe_webhook_events" USING btree ("organization_id","processed_at");--> statement-breakpoint
CREATE INDEX "subscription_plans_active_sort_idx" ON "subscription_plans" USING btree ("active","sort_order");
--> statement-breakpoint
ALTER TABLE public.subscription_plans FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.stripe_customers FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.organization_subscriptions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.stripe_webhook_events FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE public.subscription_plans, public.stripe_customers,
  public.organization_subscriptions, public.stripe_webhook_events FROM anon;
--> statement-breakpoint
GRANT SELECT ON TABLE public.subscription_plans, public.stripe_customers,
  public.organization_subscriptions, public.stripe_webhook_events TO authenticated;
--> statement-breakpoint
CREATE POLICY "subscription_plans_select_authenticated"
ON public.subscription_plans FOR SELECT TO authenticated
USING (active);
--> statement-breakpoint
CREATE POLICY "stripe_customers_select_owner"
ON public.stripe_customers FOR SELECT TO authenticated
USING (
  public.has_organization_role(
    organization_id,
    ARRAY['owner']::public.organization_role[]
  )
);
--> statement-breakpoint
CREATE POLICY "organization_subscriptions_select_owner"
ON public.organization_subscriptions FOR SELECT TO authenticated
USING (
  public.has_organization_role(
    organization_id,
    ARRAY['owner']::public.organization_role[]
  )
);
--> statement-breakpoint
CREATE POLICY "stripe_webhook_events_select_owner"
ON public.stripe_webhook_events FOR SELECT TO authenticated
USING (
  organization_id IS NOT NULL
  AND public.has_organization_role(
    organization_id,
    ARRAY['owner']::public.organization_role[]
  )
);
--> statement-breakpoint
INSERT INTO public.subscription_plans (
  id, key, name, description, monthly_price_minor, currency,
  features, limits, active, sort_order
) VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    'free',
    'Free',
    'Core workspace tools for small teams getting started.',
    0,
    'USD',
    '["Workspace and team access", "Customer management", "Manual invoicing"]'::jsonb,
    '{"maxCustomers": 25, "maxInvoices": 25}'::jsonb,
    true,
    1
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'starter',
    'Starter',
    'Higher limits for growing service businesses.',
    2900,
    'USD',
    '["Everything in Free", "500 customers", "1,000 invoices"]'::jsonb,
    '{"maxCustomers": 500, "maxInvoices": 1000}'::jsonb,
    true,
    2
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'growth',
    'Growth',
    'Unlimited customer and invoice capacity for established teams.',
    7900,
    'USD',
    '["Everything in Starter", "Unlimited customers", "Unlimited invoices"]'::jsonb,
    '{"maxCustomers": null, "maxInvoices": null}'::jsonb,
    true,
    3
  )
ON CONFLICT (key) DO NOTHING;
