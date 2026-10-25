CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'bank_transfer', 'card', 'check', 'other');--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'invoice_created';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'invoice_updated';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'invoice_sent';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'invoice_cancelled';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'payment_recorded';--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" varchar(500) NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_minor" bigint NOT NULL,
	"line_total_minor" bigint NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_items_invoice_position_unique" UNIQUE("invoice_id","position"),
	CONSTRAINT "invoice_items_description_length" CHECK (char_length(btrim("invoice_items"."description")) between 1 and 500),
	CONSTRAINT "invoice_items_quantity_range" CHECK ("invoice_items"."quantity" between 1 and 1000000),
	CONSTRAINT "invoice_items_unit_price_range" CHECK ("invoice_items"."unit_price_minor" between 0 and 1000000000),
	CONSTRAINT "invoice_items_line_total_valid" CHECK ("invoice_items"."line_total_minor" = "invoice_items"."quantity"::bigint * "invoice_items"."unit_price_minor"),
	CONSTRAINT "invoice_items_position_positive" CHECK ("invoice_items"."position" > 0)
);
--> statement-breakpoint
ALTER TABLE "invoice_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"invoice_number" varchar(64) NOT NULL,
	"number_sequence" integer NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"currency" varchar(3) NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"notes" text,
	"discount_minor" bigint DEFAULT 0 NOT NULL,
	"tax_rate_bps" integer DEFAULT 0 NOT NULL,
	"subtotal_minor" bigint DEFAULT 0 NOT NULL,
	"tax_minor" bigint DEFAULT 0 NOT NULL,
	"total_minor" bigint DEFAULT 0 NOT NULL,
	"paid_minor" bigint DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"sent_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_organization_number_unique" UNIQUE("organization_id","invoice_number"),
	CONSTRAINT "invoices_organization_sequence_unique" UNIQUE("organization_id","number_sequence"),
	CONSTRAINT "invoices_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "invoices_number_sequence_positive" CHECK ("invoices"."number_sequence" > 0),
	CONSTRAINT "invoices_currency_format" CHECK ("invoices"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "invoices_due_date_valid" CHECK ("invoices"."due_date" >= "invoices"."issue_date"),
	CONSTRAINT "invoices_notes_length" CHECK ("invoices"."notes" is null or char_length("invoices"."notes") <= 5000),
	CONSTRAINT "invoices_discount_nonnegative" CHECK ("invoices"."discount_minor" >= 0),
	CONSTRAINT "invoices_tax_rate_range" CHECK ("invoices"."tax_rate_bps" between 0 and 10000),
	CONSTRAINT "invoices_subtotal_nonnegative" CHECK ("invoices"."subtotal_minor" >= 0),
	CONSTRAINT "invoices_tax_nonnegative" CHECK ("invoices"."tax_minor" >= 0),
	CONSTRAINT "invoices_total_nonnegative" CHECK ("invoices"."total_minor" >= 0),
	CONSTRAINT "invoices_paid_valid" CHECK ("invoices"."paid_minor" between 0 and "invoices"."total_minor"),
	CONSTRAINT "invoices_discount_not_above_subtotal" CHECK ("invoices"."discount_minor" <= "invoices"."subtotal_minor"),
	CONSTRAINT "invoices_version_positive" CHECK ("invoices"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"payment_date" date NOT NULL,
	"method" "payment_method" NOT NULL,
	"reference" varchar(160),
	"notes" text,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_records_organization_idempotency_unique" UNIQUE("organization_id","idempotency_key"),
	CONSTRAINT "payment_records_amount_positive" CHECK ("payment_records"."amount_minor" > 0),
	CONSTRAINT "payment_records_reference_length" CHECK ("payment_records"."reference" is null or char_length("payment_records"."reference") between 1 and 160),
	CONSTRAINT "payment_records_notes_length" CHECK ("payment_records"."notes" is null or char_length("payment_records"."notes") <= 2000)
);
--> statement-breakpoint
ALTER TABLE "payment_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_tenant_fk" FOREIGN KEY ("organization_id","invoice_id") REFERENCES "public"."invoices"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_id_unique" UNIQUE("organization_id","id");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_tenant_fk" FOREIGN KEY ("organization_id","customer_id") REFERENCES "public"."customers"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_recorded_by_profiles_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_invoice_tenant_fk" FOREIGN KEY ("organization_id","invoice_id") REFERENCES "public"."invoices"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_items_organization_invoice_idx" ON "invoice_items" USING btree ("organization_id","invoice_id");--> statement-breakpoint
CREATE INDEX "invoices_organization_status_due_idx" ON "invoices" USING btree ("organization_id","status","due_date");--> statement-breakpoint
CREATE INDEX "invoices_organization_customer_idx" ON "invoices" USING btree ("organization_id","customer_id");--> statement-breakpoint
CREATE INDEX "invoices_organization_created_idx" ON "invoices" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_records_invoice_date_idx" ON "payment_records" USING btree ("invoice_id","payment_date","created_at");--> statement-breakpoint
CREATE INDEX "payment_records_organization_created_idx" ON "payment_records" USING btree ("organization_id","created_at");
--> statement-breakpoint
ALTER TABLE public.invoices FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.invoice_items FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.payment_records FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE public.invoices, public.invoice_items, public.payment_records FROM anon;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invoices, public.invoice_items TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE public.payment_records TO authenticated;
--> statement-breakpoint
CREATE POLICY "invoices_select_member"
ON public.invoices FOR SELECT TO authenticated
USING (public.is_organization_member(organization_id));
--> statement-breakpoint
CREATE POLICY "invoices_insert_manager"
ON public.invoices FOR INSERT TO authenticated
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND updated_by = (SELECT auth.uid())
  AND public.has_organization_role(
    organization_id,
    ARRAY['owner', 'admin']::public.organization_role[]
  )
);
--> statement-breakpoint
CREATE POLICY "invoices_update_manager"
ON public.invoices FOR UPDATE TO authenticated
USING (
  public.has_organization_role(
    organization_id,
    ARRAY['owner', 'admin']::public.organization_role[]
  )
)
WITH CHECK (
  updated_by = (SELECT auth.uid())
  AND public.has_organization_role(
    organization_id,
    ARRAY['owner', 'admin']::public.organization_role[]
  )
);
--> statement-breakpoint
CREATE POLICY "invoices_delete_manager"
ON public.invoices FOR DELETE TO authenticated
USING (
  public.has_organization_role(
    organization_id,
    ARRAY['owner', 'admin']::public.organization_role[]
  )
);
--> statement-breakpoint
CREATE POLICY "invoice_items_select_member"
ON public.invoice_items FOR SELECT TO authenticated
USING (public.is_organization_member(organization_id));
--> statement-breakpoint
CREATE POLICY "invoice_items_insert_manager"
ON public.invoice_items FOR INSERT TO authenticated
WITH CHECK (
  public.has_organization_role(
    organization_id,
    ARRAY['owner', 'admin']::public.organization_role[]
  )
);
--> statement-breakpoint
CREATE POLICY "invoice_items_update_manager"
ON public.invoice_items FOR UPDATE TO authenticated
USING (
  public.has_organization_role(
    organization_id,
    ARRAY['owner', 'admin']::public.organization_role[]
  )
)
WITH CHECK (
  public.has_organization_role(
    organization_id,
    ARRAY['owner', 'admin']::public.organization_role[]
  )
);
--> statement-breakpoint
CREATE POLICY "invoice_items_delete_manager"
ON public.invoice_items FOR DELETE TO authenticated
USING (
  public.has_organization_role(
    organization_id,
    ARRAY['owner', 'admin']::public.organization_role[]
  )
);
--> statement-breakpoint
CREATE POLICY "payment_records_select_member"
ON public.payment_records FOR SELECT TO authenticated
USING (public.is_organization_member(organization_id));
--> statement-breakpoint
CREATE POLICY "payment_records_insert_manager"
ON public.payment_records FOR INSERT TO authenticated
WITH CHECK (
  recorded_by = (SELECT auth.uid())
  AND public.has_organization_role(
    organization_id,
    ARRAY['owner', 'admin']::public.organization_role[]
  )
);
