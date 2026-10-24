ALTER TYPE "public"."audit_event_type" ADD VALUE 'customer_created';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'customer_updated';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'customer_deleted';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.audit_customer_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_events (
      organization_id, actor_id, event_type, metadata
    ) VALUES (
      NEW.organization_id,
      NEW.created_by,
      'customer_created',
      pg_catalog.jsonb_build_object(
        'customerId', NEW.id::text,
        'status', NEW.status::text
      )
    );
    RETURN NEW;
  END IF;

  IF actor_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_events (
      organization_id, actor_id, event_type, metadata
    ) VALUES (
      NEW.organization_id,
      NEW.updated_by,
      'customer_updated',
      pg_catalog.jsonb_build_object(
        'customerId', NEW.id::text,
        'previousStatus', OLD.status::text,
        'newStatus', NEW.status::text,
        'nameChanged', (OLD.name IS DISTINCT FROM NEW.name)::text
      )
    );
    RETURN NEW;
  END IF;

  INSERT INTO public.audit_events (
    organization_id, actor_id, event_type, metadata
  ) VALUES (
    OLD.organization_id,
    actor_id,
    'customer_deleted',
    pg_catalog.jsonb_build_object(
      'customerId', OLD.id::text,
      'status', OLD.status::text
    )
  );
  RETURN OLD;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.audit_customer_change() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER customers_audit
AFTER INSERT OR UPDATE OR DELETE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.audit_customer_change();
