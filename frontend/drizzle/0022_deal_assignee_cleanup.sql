ALTER TABLE "deals" DROP CONSTRAINT "deals_assignee_tenant_fk";
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.protect_and_sync_deal()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE stage_kind public.pipeline_stage_kind;
BEGIN
  SELECT kind INTO stage_kind FROM public.pipeline_stages
  WHERE organization_id = NEW.organization_id AND id = NEW.stage_id;
  IF stage_kind IS NULL THEN RAISE EXCEPTION 'invalid pipeline stage'; END IF;
  IF NEW.assigned_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = NEW.organization_id AND user_id = NEW.assigned_user_id
  ) THEN RAISE EXCEPTION 'deal assignee must belong to the organization'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'deal identity fields are immutable';
    END IF;
    NEW.updated_by := COALESCE(auth.uid(), OLD.updated_by);
    NEW.version := OLD.version + 1;
    NEW.updated_at := now();
  END IF;
  NEW.outcome := stage_kind::text::public.deal_outcome;
  IF stage_kind = 'open' THEN NEW.closed_at := NULL; NEW.outcome_reason := NULL;
  ELSIF NEW.closed_at IS NULL THEN NEW.closed_at := now(); END IF;
  RETURN NEW;
END; $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.unassign_deals_for_removed_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.deals SET assigned_user_id = NULL
  WHERE organization_id = OLD.organization_id AND assigned_user_id = OLD.user_id;
  RETURN OLD;
END; $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.unassign_deals_for_removed_member() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER organization_members_unassign_deals
BEFORE DELETE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.unassign_deals_for_removed_member();
