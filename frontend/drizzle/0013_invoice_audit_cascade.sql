CREATE OR REPLACE FUNCTION public.audit_invoice_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid;
  event_value public.audit_event_type;
  event_metadata jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    event_value := 'invoice_created';
    actor_id := NEW.created_by;
    event_metadata := pg_catalog.jsonb_build_object(
      'invoiceId', NEW.id::text,
      'invoiceNumber', NEW.invoice_number,
      'status', NEW.status::text
    );
  ELSIF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.organizations WHERE id = OLD.organization_id
    ) THEN
      RETURN OLD;
    END IF;
    actor_id := (SELECT auth.uid());
    event_value := 'invoice_deleted';
    event_metadata := pg_catalog.jsonb_build_object(
      'invoiceId', OLD.id::text,
      'invoiceNumber', OLD.invoice_number,
      'status', OLD.status::text
    );
  ELSIF NEW.paid_minor IS DISTINCT FROM OLD.paid_minor THEN
    RETURN NEW;
  ELSE
    actor_id := COALESCE((SELECT auth.uid()), NEW.updated_by);
    event_value := CASE
      WHEN NEW.status = 'sent' AND OLD.status <> 'sent' THEN 'invoice_sent'::public.audit_event_type
      WHEN NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN 'invoice_cancelled'::public.audit_event_type
      ELSE 'invoice_updated'::public.audit_event_type
    END;
    event_metadata := pg_catalog.jsonb_build_object(
      'invoiceId', NEW.id::text,
      'invoiceNumber', NEW.invoice_number,
      'previousStatus', OLD.status::text,
      'newStatus', NEW.status::text
    );
  END IF;

  IF actor_id IS NOT NULL THEN
    INSERT INTO public.audit_events (organization_id, actor_id, event_type, metadata)
    VALUES (
      CASE WHEN TG_OP = 'DELETE' THEN OLD.organization_id ELSE NEW.organization_id END,
      actor_id,
      event_value,
      event_metadata
    );
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.audit_invoice_change() FROM PUBLIC;
