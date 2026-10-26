CREATE OR REPLACE FUNCTION public.process_stripe_subscription_event(
  target_event_id text,
  target_event_type text,
  target_organization_id uuid,
  target_plan_key text,
  target_customer_id text,
  target_subscription_id text,
  target_price_id text,
  target_status public.subscription_status,
  target_cancel_at_period_end boolean,
  target_period_start timestamptz,
  target_period_end timestamptz,
  target_ended_at timestamptz,
  target_event_created bigint,
  target_payload_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  mapped_organization_id uuid;
  mapped_plan_id uuid;
BEGIN
  IF target_event_id !~ '^evt_[A-Za-z0-9]+$'
    OR target_subscription_id !~ '^sub_[A-Za-z0-9]+$'
    OR target_customer_id !~ '^cus_[A-Za-z0-9]+$'
    OR target_price_id !~ '^price_[A-Za-z0-9]+$'
    OR target_payload_hash !~ '^[a-f0-9]{64}$'
    OR target_event_created < 0 THEN
    RAISE EXCEPTION 'invalid Stripe event data' USING ERRCODE = '22023';
  END IF;

  SELECT organization_id INTO mapped_organization_id
  FROM public.stripe_customers
  WHERE stripe_customer_id = target_customer_id;

  IF mapped_organization_id IS NULL OR mapped_organization_id <> target_organization_id THEN
    RAISE EXCEPTION 'Stripe customer does not match organization' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO mapped_plan_id
  FROM public.subscription_plans
  WHERE key = target_plan_key AND active;

  IF mapped_plan_id IS NULL THEN
    RAISE EXCEPTION 'unknown subscription plan' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.stripe_webhook_events (
    stripe_event_id, event_type, organization_id, payload_sha256, stripe_created_at
  ) VALUES (
    target_event_id, target_event_type, mapped_organization_id,
    target_payload_hash, target_event_created
  ) ON CONFLICT (stripe_event_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.organization_subscriptions (
    organization_id, plan_id, stripe_customer_id, stripe_subscription_id,
    stripe_price_id, status, cancel_at_period_end, current_period_start,
    current_period_end, ended_at, stripe_event_created_at
  ) VALUES (
    mapped_organization_id, mapped_plan_id, target_customer_id,
    target_subscription_id, target_price_id, target_status,
    target_cancel_at_period_end, target_period_start, target_period_end,
    target_ended_at, target_event_created
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    stripe_price_id = EXCLUDED.stripe_price_id,
    status = EXCLUDED.status,
    cancel_at_period_end = EXCLUDED.cancel_at_period_end,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    ended_at = EXCLUDED.ended_at,
    stripe_event_created_at = EXCLUDED.stripe_event_created_at,
    updated_at = now()
  WHERE public.organization_subscriptions.stripe_event_created_at <= EXCLUDED.stripe_event_created_at;

  RETURN true;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.process_stripe_subscription_event(
  text, text, uuid, text, text, text, text, public.subscription_status,
  boolean, timestamptz, timestamptz, timestamptz, bigint, text
) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.process_stripe_subscription_event(
  text, text, uuid, text, text, text, text, public.subscription_status,
  boolean, timestamptz, timestamptz, timestamptz, bigint, text
) TO authenticated;
