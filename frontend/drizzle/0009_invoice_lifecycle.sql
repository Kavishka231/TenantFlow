REVOKE INSERT ON TABLE public.payment_records FROM authenticated;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.invoice_effective_status(
  stored_status public.invoice_status,
  due_date date
)
RETURNS public.invoice_status
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN stored_status = 'sent' AND due_date < CURRENT_DATE THEN 'overdue'::public.invoice_status
    ELSE stored_status
  END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.invoice_effective_status(public.invoice_status, date) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.invoice_effective_status(public.invoice_status, date) TO authenticated;
--> statement-breakpoint
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
    IF OLD.status <> 'draft' THEN
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
--> statement-breakpoint
CREATE TRIGGER invoices_protect_change
BEFORE UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.protect_invoice_change();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.require_draft_invoice_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  target_organization uuid := COALESCE(NEW.organization_id, OLD.organization_id);
  target_invoice uuid := COALESCE(NEW.invoice_id, OLD.invoice_id);
  current_status public.invoice_status;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.id IS DISTINCT FROM OLD.id
    OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.invoice_id IS DISTINCT FROM OLD.invoice_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'invoice item identity fields are immutable';
  END IF;

  SELECT status INTO current_status
  FROM public.invoices
  WHERE organization_id = target_organization AND id = target_invoice
  FOR UPDATE;

  IF current_status IS NULL OR current_status <> 'draft' THEN
    RAISE EXCEPTION 'items can only change on a draft invoice';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.require_draft_invoice_item() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER invoice_items_require_draft
BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.require_draft_invoice_item();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.send_invoice(
  target_organization uuid,
  target_invoice uuid
)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  current_invoice public.invoices;
BEGIN
  IF actor_id IS NULL OR NOT public.has_organization_role(
    target_organization,
    ARRAY['owner', 'admin']::public.organization_role[]
  ) THEN
    RAISE EXCEPTION 'invoice management permission required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO current_invoice FROM public.invoices
  WHERE organization_id = target_organization AND id = target_invoice
  FOR UPDATE;
  IF current_invoice.id IS NULL OR current_invoice.status <> 'draft' THEN
    RAISE EXCEPTION 'only a draft invoice can be sent';
  END IF;
  IF current_invoice.total_minor <= 0 THEN
    RAISE EXCEPTION 'an invoice total must be positive before sending';
  END IF;

  PERFORM pg_catalog.set_config('tenantflow.invoice_lifecycle', 'on', true);
  UPDATE public.invoices
  SET status = 'sent', sent_at = pg_catalog.now(), updated_by = actor_id
  WHERE id = target_invoice AND organization_id = target_organization
  RETURNING * INTO current_invoice;
  RETURN current_invoice;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.send_invoice(uuid, uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.send_invoice(uuid, uuid) TO authenticated;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.cancel_invoice(
  target_organization uuid,
  target_invoice uuid
)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  current_invoice public.invoices;
BEGIN
  IF actor_id IS NULL OR NOT public.has_organization_role(
    target_organization,
    ARRAY['owner', 'admin']::public.organization_role[]
  ) THEN
    RAISE EXCEPTION 'invoice management permission required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO current_invoice FROM public.invoices
  WHERE organization_id = target_organization AND id = target_invoice
  FOR UPDATE;
  IF current_invoice.id IS NULL
    OR current_invoice.status NOT IN ('draft', 'sent', 'overdue')
    OR current_invoice.paid_minor <> 0 THEN
    RAISE EXCEPTION 'this invoice cannot be cancelled';
  END IF;

  PERFORM pg_catalog.set_config('tenantflow.invoice_lifecycle', 'on', true);
  UPDATE public.invoices
  SET status = 'cancelled', cancelled_at = pg_catalog.now(), updated_by = actor_id
  WHERE id = target_invoice AND organization_id = target_organization
  RETURNING * INTO current_invoice;
  RETURN current_invoice;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.cancel_invoice(uuid, uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.cancel_invoice(uuid, uuid) TO authenticated;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  target_organization uuid,
  target_invoice uuid,
  payment_key uuid,
  payment_amount bigint,
  paid_on date,
  payment_method_value public.payment_method,
  payment_reference varchar,
  payment_notes text
)
RETURNS public.payment_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  current_invoice public.invoices;
  existing_payment public.payment_records;
  created_payment public.payment_records;
  new_paid bigint;
BEGIN
  IF actor_id IS NULL OR NOT public.has_organization_role(
    target_organization,
    ARRAY['owner', 'admin']::public.organization_role[]
  ) THEN
    RAISE EXCEPTION 'invoice management permission required' USING ERRCODE = '42501';
  END IF;
  IF payment_amount <= 0 OR paid_on > CURRENT_DATE THEN
    RAISE EXCEPTION 'invalid payment amount or date';
  END IF;

  SELECT * INTO current_invoice FROM public.invoices
  WHERE organization_id = target_organization AND id = target_invoice
  FOR UPDATE;
  IF current_invoice.id IS NULL OR current_invoice.status NOT IN ('sent', 'partially_paid', 'overdue') THEN
    RAISE EXCEPTION 'payments require an active sent invoice';
  END IF;

  SELECT * INTO existing_payment FROM public.payment_records
  WHERE organization_id = target_organization AND idempotency_key = payment_key;
  IF existing_payment.id IS NOT NULL THEN
    IF existing_payment.invoice_id <> target_invoice
      OR existing_payment.amount_minor <> payment_amount THEN
      RAISE EXCEPTION 'idempotency key already used for another payment';
    END IF;
    RETURN existing_payment;
  END IF;

  new_paid := current_invoice.paid_minor + payment_amount;
  IF new_paid > current_invoice.total_minor THEN
    RAISE EXCEPTION 'payment exceeds the outstanding balance';
  END IF;

  INSERT INTO public.payment_records (
    organization_id, invoice_id, idempotency_key, amount_minor,
    payment_date, method, reference, notes, recorded_by
  ) VALUES (
    target_organization, target_invoice, payment_key, payment_amount,
    paid_on, payment_method_value, payment_reference, payment_notes, actor_id
  ) RETURNING * INTO created_payment;

  PERFORM pg_catalog.set_config('tenantflow.invoice_lifecycle', 'on', true);
  UPDATE public.invoices
  SET paid_minor = new_paid,
      status = CASE WHEN new_paid = total_minor THEN 'paid'::public.invoice_status ELSE 'partially_paid'::public.invoice_status END,
      updated_by = actor_id
  WHERE id = target_invoice AND organization_id = target_organization;
  RETURN created_payment;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.record_invoice_payment(uuid, uuid, uuid, bigint, date, public.payment_method, varchar, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.record_invoice_payment(uuid, uuid, uuid, bigint, date, public.payment_method, varchar, text) TO authenticated;
