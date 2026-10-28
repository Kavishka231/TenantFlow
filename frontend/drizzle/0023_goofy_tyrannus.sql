CREATE TYPE "public"."expense_status" AS ENUM('pending', 'paid', 'reimbursed', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'expense_created';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'expense_updated';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'expense_status_changed';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'expense_receipt_attached';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'expense_receipt_removed';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'expense_deleted';--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"color" varchar(7) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_categories_organization_name_unique" UNIQUE("organization_id","name"),
	CONSTRAINT "expense_categories_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "expense_categories_name_length" CHECK (char_length(btrim("expense_categories"."name")) between 1 and 80),
	CONSTRAINT "expense_categories_color_format" CHECK ("expense_categories"."color" ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
ALTER TABLE "expense_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"expense_date" date NOT NULL,
	"vendor" varchar(160) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"status" "expense_status" DEFAULT 'pending' NOT NULL,
	"paid_date" date,
	"description" text,
	"receipt_path" text,
	"receipt_name" varchar(255),
	"receipt_mime_type" varchar(100),
	"receipt_size" integer,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "expenses_amount_range" CHECK ("expenses"."amount_minor" between 1 and 1000000000000),
	CONSTRAINT "expenses_currency_format" CHECK ("expenses"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "expenses_vendor_length" CHECK (char_length(btrim("expenses"."vendor")) between 1 and 160),
	CONSTRAINT "expenses_description_length" CHECK ("expenses"."description" is null or char_length("expenses"."description") <= 5000),
	CONSTRAINT "expenses_payment_state_valid" CHECK (("expenses"."status" in ('paid', 'reimbursed') and "expenses"."paid_date" is not null) or ("expenses"."status" in ('pending', 'cancelled') and "expenses"."paid_date" is null)),
	CONSTRAINT "expenses_receipt_metadata_complete" CHECK (("expenses"."receipt_path" is null and "expenses"."receipt_name" is null and "expenses"."receipt_mime_type" is null and "expenses"."receipt_size" is null) or ("expenses"."receipt_path" is not null and "expenses"."receipt_name" is not null and "expenses"."receipt_mime_type" is not null and "expenses"."receipt_size" is not null)),
	CONSTRAINT "expenses_receipt_path_tenant" CHECK ("expenses"."receipt_path" is null or "expenses"."receipt_path" like "expenses"."organization_id"::text || '/%'),
	CONSTRAINT "expenses_receipt_size_range" CHECK ("expenses"."receipt_size" is null or "expenses"."receipt_size" between 1 and 5242880),
	CONSTRAINT "expenses_version_positive" CHECK ("expenses"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_tenant_fk" FOREIGN KEY ("organization_id","category_id") REFERENCES "public"."expense_categories"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_categories_organization_name_idx" ON "expense_categories" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_receipt_path_unique" ON "expenses" USING btree ("receipt_path") WHERE "expenses"."receipt_path" is not null;--> statement-breakpoint
CREATE INDEX "expenses_organization_date_idx" ON "expenses" USING btree ("organization_id","expense_date");--> statement-breakpoint
CREATE INDEX "expenses_organization_status_date_idx" ON "expenses" USING btree ("organization_id","status","expense_date");--> statement-breakpoint
CREATE INDEX "expenses_organization_category_date_idx" ON "expenses" USING btree ("organization_id","category_id","expense_date");--> statement-breakpoint
CREATE INDEX "expenses_organization_vendor_idx" ON "expenses" USING btree ("organization_id","vendor");
--> statement-breakpoint
ALTER TABLE public.expense_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.expenses FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.expense_categories, public.expenses FROM anon;
REVOKE ALL ON public.expense_categories, public.expenses FROM authenticated;
GRANT SELECT ON public.expense_categories, public.expenses TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.expense_categories, public.expenses TO authenticated;
--> statement-breakpoint
CREATE POLICY "expense_categories_select_member" ON public.expense_categories
FOR SELECT TO authenticated USING (public.is_organization_member(organization_id));
CREATE POLICY "expense_categories_insert_manager" ON public.expense_categories
FOR INSERT TO authenticated WITH CHECK (public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[]));
CREATE POLICY "expense_categories_update_manager" ON public.expense_categories
FOR UPDATE TO authenticated USING (public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[]))
WITH CHECK (public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[]));
CREATE POLICY "expense_categories_delete_manager" ON public.expense_categories
FOR DELETE TO authenticated USING (public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[]));
CREATE POLICY "expenses_select_member" ON public.expenses
FOR SELECT TO authenticated USING (public.is_organization_member(organization_id));
CREATE POLICY "expenses_insert_manager" ON public.expenses
FOR INSERT TO authenticated WITH CHECK (
  created_by = auth.uid() AND updated_by = auth.uid()
  AND public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[])
);
CREATE POLICY "expenses_update_manager" ON public.expenses
FOR UPDATE TO authenticated USING (public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[]))
WITH CHECK (public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[]));
CREATE POLICY "expenses_delete_manager" ON public.expenses
FOR DELETE TO authenticated USING (public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[]));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.protect_expense_category()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'expense category identity fields are immutable';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.protect_expense_category() FROM PUBLIC;
CREATE TRIGGER expense_categories_protect BEFORE UPDATE ON public.expense_categories
FOR EACH ROW EXECUTE FUNCTION public.protect_expense_category();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.protect_expense()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'expense identity fields are immutable';
    END IF;
    NEW.updated_by := auth.uid();
    NEW.version := OLD.version + 1;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.protect_expense() FROM PUBLIC;
CREATE TRIGGER expenses_protect BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.protect_expense();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.record_expense_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := COALESCE(auth.uid(), OLD.updated_by, NEW.updated_by);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_events (organization_id, actor_id, event_type, metadata)
    VALUES (NEW.organization_id, actor, 'expense_created', jsonb_build_object('expenseId', NEW.id::text, 'categoryId', NEW.category_id::text, 'status', NEW.status::text));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_events (organization_id, actor_id, event_type, metadata)
    VALUES (OLD.organization_id, actor, 'expense_deleted', jsonb_build_object('expenseId', OLD.id::text, 'categoryId', OLD.category_id::text, 'status', OLD.status::text));
    RETURN OLD;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.audit_events (organization_id, actor_id, event_type, metadata)
    VALUES (NEW.organization_id, actor, 'expense_status_changed', jsonb_build_object('expenseId', NEW.id::text, 'from', OLD.status::text, 'to', NEW.status::text));
  END IF;
  IF NEW.receipt_path IS DISTINCT FROM OLD.receipt_path THEN
    INSERT INTO public.audit_events (organization_id, actor_id, event_type, metadata)
    VALUES (NEW.organization_id, actor,
      CASE WHEN NEW.receipt_path IS NULL THEN 'expense_receipt_removed'::public.audit_event_type ELSE 'expense_receipt_attached'::public.audit_event_type END,
      jsonb_build_object('expenseId', NEW.id::text));
  END IF;
  IF ROW(NEW.category_id, NEW.amount_minor, NEW.currency, NEW.expense_date, NEW.vendor, NEW.payment_method, NEW.paid_date, NEW.description)
    IS DISTINCT FROM ROW(OLD.category_id, OLD.amount_minor, OLD.currency, OLD.expense_date, OLD.vendor, OLD.payment_method, OLD.paid_date, OLD.description) THEN
    INSERT INTO public.audit_events (organization_id, actor_id, event_type, metadata)
    VALUES (NEW.organization_id, actor, 'expense_updated', jsonb_build_object('expenseId', NEW.id::text, 'categoryId', NEW.category_id::text));
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.record_expense_audit() FROM PUBLIC;
CREATE TRIGGER expenses_audit AFTER INSERT OR UPDATE OR DELETE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.record_expense_audit();
--> statement-breakpoint
INSERT INTO public.expense_categories (organization_id, name, color)
SELECT organization.id, category.name, category.color
FROM public.organizations organization CROSS JOIN (VALUES
  ('Operations','#6366F1'),('Marketing','#EC4899'),('Software','#8B5CF6'),
  ('Travel','#F59E0B'),('Office','#10B981'),('Other','#64748B')
) AS category(name,color)
ON CONFLICT (organization_id, name) DO NOTHING;
--> statement-breakpoint
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('expense-receipts', 'expense-receipts', false, 5242880, ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.receipt_organization_id(object_name text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN split_part(object_name, '/', 1)::uuid;
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.receipt_organization_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.receipt_organization_id(text) TO authenticated;
--> statement-breakpoint
CREATE POLICY "expense_receipts_select_member" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'expense-receipts' AND public.is_organization_member(public.receipt_organization_id(name))
);
CREATE POLICY "expense_receipts_insert_manager" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'expense-receipts' AND owner_id = auth.uid()::text
  AND public.has_organization_role(public.receipt_organization_id(name), ARRAY['owner','admin']::public.organization_role[])
);
CREATE POLICY "expense_receipts_update_manager" ON storage.objects
FOR UPDATE TO authenticated USING (
  bucket_id = 'expense-receipts'
  AND public.has_organization_role(public.receipt_organization_id(name), ARRAY['owner','admin']::public.organization_role[])
) WITH CHECK (
  bucket_id = 'expense-receipts'
  AND public.has_organization_role(public.receipt_organization_id(name), ARRAY['owner','admin']::public.organization_role[])
);
CREATE POLICY "expense_receipts_delete_manager" ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'expense-receipts'
  AND public.has_organization_role(public.receipt_organization_id(name), ARRAY['owner','admin']::public.organization_role[])
);
