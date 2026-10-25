CREATE OR REPLACE FUNCTION public.protect_invoice_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  lifecycle_change boolean := COALESCE(
    pg_catalog.current_setting('tenantflow.invoice_lifecycle', true),
    'off'
  ) = 'on';
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' AND EXISTS (
      SELECT 1 FROM public.organizations WHERE id = OLD.organization_id
    ) THEN
      RAISE EXCEPTION 'only draft invoices can be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
    OR NEW.number_sequence IS DISTINCT FROM OLD.number_sequence
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'invoice identity fields are immutable';
  END IF;

  IF NOT lifecycle_change AND (
    NEW.status IS DISTINCT FROM OLD.status
    OR NEW.paid_minor IS DISTINCT FROM OLD.paid_minor
    OR NEW.sent_at IS DISTINCT FROM OLD.sent_at
    OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
  ) THEN
    RAISE EXCEPTION 'invoice lifecycle fields require a lifecycle function';
  END IF;

  IF NOT lifecycle_change AND OLD.status <> 'draft' AND (
    NEW.customer_id IS DISTINCT FROM OLD.customer_id
    OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.issue_date IS DISTINCT FROM OLD.issue_date
    OR NEW.due_date IS DISTINCT FROM OLD.due_date
    OR NEW.notes IS DISTINCT FROM OLD.notes
    OR NEW.discount_minor IS DISTINCT FROM OLD.discount_minor
    OR NEW.tax_rate_bps IS DISTINCT FROM OLD.tax_rate_bps
    OR NEW.subtotal_minor IS DISTINCT FROM OLD.subtotal_minor
    OR NEW.tax_minor IS DISTINCT FROM OLD.tax_minor
    OR NEW.total_minor IS DISTINCT FROM OLD.total_minor
  ) THEN
    RAISE EXCEPTION 'only draft invoices can be edited';
  END IF;

  NEW.version := OLD.version + 1;
  NEW.updated_at := pg_catalog.now();
  NEW.updated_by := COALESCE((SELECT auth.uid()), NEW.updated_by);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.protect_invoice_change() FROM PUBLIC;
