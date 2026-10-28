CREATE TYPE "public"."deal_activity_type" AS ENUM('created', 'updated', 'stage_changed', 'won', 'lost', 'note_added');--> statement-breakpoint
CREATE TYPE "public"."deal_outcome" AS ENUM('open', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."pipeline_stage_kind" AS ENUM('open', 'won', 'lost');--> statement-breakpoint
CREATE TABLE "deal_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"type" "deal_activity_type" NOT NULL,
	"note" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deal_activities_note_length" CHECK ("deal_activities"."note" is null or char_length(btrim("deal_activities"."note")) between 1 and 5000)
);
--> statement-breakpoint
ALTER TABLE "deal_activities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"assigned_user_id" uuid,
	"title" varchar(200) NOT NULL,
	"description" text,
	"value_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"expected_close_date" date,
	"outcome" "deal_outcome" DEFAULT 'open' NOT NULL,
	"outcome_reason" varchar(500),
	"closed_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deals_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "deals_title_length" CHECK (char_length(btrim("deals"."title")) between 1 and 200),
	CONSTRAINT "deals_description_length" CHECK ("deals"."description" is null or char_length("deals"."description") <= 5000),
	CONSTRAINT "deals_value_range" CHECK ("deals"."value_minor" between 0 and 1000000000000),
	CONSTRAINT "deals_currency_format" CHECK ("deals"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "deals_outcome_reason_length" CHECK ("deals"."outcome_reason" is null or char_length("deals"."outcome_reason") between 1 and 500),
	CONSTRAINT "deals_version_positive" CHECK ("deals"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "deals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"color" varchar(7) NOT NULL,
	"position" integer NOT NULL,
	"kind" "pipeline_stage_kind" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pipeline_stages_organization_name_unique" UNIQUE("organization_id","name"),
	CONSTRAINT "pipeline_stages_organization_position_unique" UNIQUE("organization_id","position"),
	CONSTRAINT "pipeline_stages_organization_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "pipeline_stages_name_length" CHECK (char_length(btrim("pipeline_stages"."name")) between 1 and 80),
	CONSTRAINT "pipeline_stages_color_format" CHECK ("pipeline_stages"."color" ~ '^#[0-9A-Fa-f]{6}$'),
	CONSTRAINT "pipeline_stages_position_positive" CHECK ("pipeline_stages"."position" > 0)
);
--> statement-breakpoint
ALTER TABLE "pipeline_stages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "deal_activities" ADD CONSTRAINT "deal_activities_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_activities" ADD CONSTRAINT "deal_activities_deal_tenant_fk" FOREIGN KEY ("organization_id","deal_id") REFERENCES "public"."deals"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_customer_tenant_fk" FOREIGN KEY ("organization_id","customer_id") REFERENCES "public"."customers"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_stage_tenant_fk" FOREIGN KEY ("organization_id","stage_id") REFERENCES "public"."pipeline_stages"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_assignee_tenant_fk" FOREIGN KEY ("organization_id","assigned_user_id") REFERENCES "public"."organization_members"("organization_id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_activities_organization_deal_created_idx" ON "deal_activities" USING btree ("organization_id","deal_id","created_at");--> statement-breakpoint
CREATE INDEX "deals_organization_stage_idx" ON "deals" USING btree ("organization_id","stage_id");--> statement-breakpoint
CREATE INDEX "deals_organization_customer_idx" ON "deals" USING btree ("organization_id","customer_id");--> statement-breakpoint
CREATE INDEX "deals_organization_assignee_idx" ON "deals" USING btree ("organization_id","assigned_user_id");--> statement-breakpoint
CREATE INDEX "deals_organization_close_date_idx" ON "deals" USING btree ("organization_id","expected_close_date");--> statement-breakpoint
CREATE INDEX "deals_organization_outcome_idx" ON "deals" USING btree ("organization_id","outcome");--> statement-breakpoint
CREATE INDEX "pipeline_stages_organization_kind_idx" ON "pipeline_stages" USING btree ("organization_id","kind");
--> statement-breakpoint
CREATE UNIQUE INDEX "pipeline_stages_one_won_per_organization" ON public.pipeline_stages (organization_id) WHERE kind = 'won';
--> statement-breakpoint
CREATE UNIQUE INDEX "pipeline_stages_one_lost_per_organization" ON public.pipeline_stages (organization_id) WHERE kind = 'lost';
--> statement-breakpoint
ALTER TABLE public.pipeline_stages FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.deals FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.deal_activities FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE public.pipeline_stages, public.deals, public.deal_activities FROM anon;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pipeline_stages, public.deals TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE public.deal_activities TO authenticated;
--> statement-breakpoint
CREATE POLICY "pipeline_stages_select_member" ON public.pipeline_stages FOR SELECT TO authenticated
USING (public.is_organization_member(organization_id));
--> statement-breakpoint
CREATE POLICY "pipeline_stages_insert_manager" ON public.pipeline_stages FOR INSERT TO authenticated
WITH CHECK (public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[]));
--> statement-breakpoint
CREATE POLICY "pipeline_stages_update_manager" ON public.pipeline_stages FOR UPDATE TO authenticated
USING (public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[]))
WITH CHECK (public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[]));
--> statement-breakpoint
CREATE POLICY "pipeline_stages_delete_manager" ON public.pipeline_stages FOR DELETE TO authenticated
USING (public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[]));
--> statement-breakpoint
CREATE POLICY "deals_select_member" ON public.deals FOR SELECT TO authenticated
USING (public.is_organization_member(organization_id));
--> statement-breakpoint
CREATE POLICY "deals_insert_manager" ON public.deals FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND updated_by = auth.uid() AND public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[]));
--> statement-breakpoint
CREATE POLICY "deals_update_manager" ON public.deals FOR UPDATE TO authenticated
USING (public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[]))
WITH CHECK (updated_by = auth.uid() AND public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[]));
--> statement-breakpoint
CREATE POLICY "deals_delete_manager" ON public.deals FOR DELETE TO authenticated
USING (public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[]));
--> statement-breakpoint
CREATE POLICY "deal_activities_select_member" ON public.deal_activities FOR SELECT TO authenticated
USING (public.is_organization_member(organization_id));
--> statement-breakpoint
CREATE POLICY "deal_activities_insert_note_manager" ON public.deal_activities FOR INSERT TO authenticated
WITH CHECK (type = 'note_added' AND actor_id = auth.uid() AND note IS NOT NULL AND public.has_organization_role(organization_id, ARRAY['owner','admin']::public.organization_role[]));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.protect_pipeline_stage()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'pipeline stage identity and kind are immutable';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.protect_pipeline_stage() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER pipeline_stages_protect BEFORE UPDATE ON public.pipeline_stages
FOR EACH ROW EXECUTE FUNCTION public.protect_pipeline_stage();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.protect_and_sync_deal()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE stage_kind public.pipeline_stage_kind;
BEGIN
  SELECT kind INTO stage_kind FROM public.pipeline_stages
  WHERE organization_id = NEW.organization_id AND id = NEW.stage_id;
  IF stage_kind IS NULL THEN RAISE EXCEPTION 'invalid pipeline stage'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'deal identity fields are immutable';
    END IF;
    NEW.updated_by := auth.uid(); NEW.version := OLD.version + 1; NEW.updated_at := now();
  END IF;
  NEW.outcome := stage_kind::text::public.deal_outcome;
  IF stage_kind = 'open' THEN NEW.closed_at := NULL; NEW.outcome_reason := NULL;
  ELSIF NEW.closed_at IS NULL THEN NEW.closed_at := now(); END IF;
  RETURN NEW;
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.protect_and_sync_deal() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER deals_protect_and_sync BEFORE INSERT OR UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.protect_and_sync_deal();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.record_deal_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE activity_type public.deal_activity_type; activity_metadata jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN activity_type := 'created'; activity_metadata := jsonb_build_object('stageId', NEW.stage_id::text);
  ELSIF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    IF NEW.outcome = 'won' THEN activity_type := 'won'; ELSIF NEW.outcome = 'lost' THEN activity_type := 'lost'; ELSE activity_type := 'stage_changed'; END IF;
    activity_metadata := jsonb_build_object('fromStageId', OLD.stage_id::text, 'toStageId', NEW.stage_id::text);
  ELSE activity_type := 'updated'; activity_metadata := '{}'::jsonb; END IF;
  INSERT INTO public.deal_activities(organization_id, deal_id, actor_id, type, metadata)
  VALUES (NEW.organization_id, NEW.id, COALESCE(auth.uid(), NEW.updated_by), activity_type, activity_metadata);
  RETURN NEW;
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.record_deal_activity() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER deals_activity AFTER INSERT OR UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.record_deal_activity();
--> statement-breakpoint
INSERT INTO public.pipeline_stages (organization_id, name, color, position, kind)
SELECT id, stage.name, stage.color, stage.position, stage.kind::public.pipeline_stage_kind
FROM public.organizations CROSS JOIN (VALUES
  ('Lead','#64748B',1,'open'),('Qualified','#6366F1',2,'open'),('Proposal','#F59E0B',3,'open'),
  ('Won','#10B981',4,'won'),('Lost','#EF4444',5,'lost')
) AS stage(name,color,position,kind)
ON CONFLICT (organization_id, name) DO NOTHING;
