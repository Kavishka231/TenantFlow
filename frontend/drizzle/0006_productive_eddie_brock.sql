CREATE TYPE "public"."customer_status" AS ENUM('lead', 'active', 'inactive');--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"email" varchar(320),
	"phone" varchar(32),
	"company" varchar(160),
	"address" text,
	"status" "customer_status" DEFAULT 'lead' NOT NULL,
	"notes" text,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_name_length" CHECK (char_length(btrim("customers"."name")) between 1 and 160),
	CONSTRAINT "customers_email_length" CHECK ("customers"."email" is null or char_length("customers"."email") between 3 and 320),
	CONSTRAINT "customers_phone_length" CHECK ("customers"."phone" is null or char_length("customers"."phone") between 3 and 32),
	CONSTRAINT "customers_company_length" CHECK ("customers"."company" is null or char_length("customers"."company") between 1 and 160),
	CONSTRAINT "customers_address_length" CHECK ("customers"."address" is null or char_length("customers"."address") <= 1000),
	CONSTRAINT "customers_notes_length" CHECK ("customers"."notes" is null or char_length("customers"."notes") <= 5000),
	CONSTRAINT "customers_version_positive" CHECK ("customers"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_organization_name_idx" ON "customers" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "customers_organization_status_idx" ON "customers" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "customers_organization_created_idx" ON "customers" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "customers_organization_updated_idx" ON "customers" USING btree ("organization_id","updated_at");
--> statement-breakpoint
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE public.customers FROM anon;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customers TO authenticated;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.protect_customer_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'customer identity fields are immutable';
  END IF;

  NEW.updated_by := (SELECT auth.uid());
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.protect_customer_identity() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER customers_protect_identity
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.protect_customer_identity();
--> statement-breakpoint
CREATE TRIGGER customers_set_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE POLICY "customers_select_member"
ON public.customers FOR SELECT TO authenticated
USING (public.is_organization_member(organization_id));
--> statement-breakpoint
CREATE POLICY "customers_insert_manager"
ON public.customers FOR INSERT TO authenticated
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND updated_by = (SELECT auth.uid())
  AND public.has_organization_role(
    organization_id,
    ARRAY['owner', 'admin']::public.organization_role[]
  )
);
--> statement-breakpoint
CREATE POLICY "customers_update_manager"
ON public.customers FOR UPDATE TO authenticated
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
CREATE POLICY "customers_delete_manager"
ON public.customers FOR DELETE TO authenticated
USING (
  public.has_organization_role(
    organization_id,
    ARRAY['owner', 'admin']::public.organization_role[]
  )
);
