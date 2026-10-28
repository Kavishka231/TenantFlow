CREATE INDEX "expenses_organization_currency_date_idx" ON "expenses" USING btree ("organization_id","currency","expense_date");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.record_expense_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    actor := COALESCE(auth.uid(), NEW.updated_by);
    INSERT INTO public.audit_events (organization_id, actor_id, event_type, metadata)
    VALUES (NEW.organization_id, actor, 'expense_created', jsonb_build_object('expenseId', NEW.id::text, 'categoryId', NEW.category_id::text, 'status', NEW.status::text));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    actor := COALESCE(auth.uid(), OLD.updated_by);
    INSERT INTO public.audit_events (organization_id, actor_id, event_type, metadata)
    VALUES (OLD.organization_id, actor, 'expense_deleted', jsonb_build_object('expenseId', OLD.id::text, 'categoryId', OLD.category_id::text, 'status', OLD.status::text));
    RETURN OLD;
  END IF;

  actor := COALESCE(auth.uid(), NEW.updated_by, OLD.updated_by);
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
