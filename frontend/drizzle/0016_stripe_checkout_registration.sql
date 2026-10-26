CREATE OR REPLACE FUNCTION public.register_stripe_customer(
  target_organization_id uuid,
  target_stripe_customer_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_organization_role(
    target_organization_id,
    ARRAY['owner']::public.organization_role[]
  ) THEN
    RAISE EXCEPTION 'organization owner access required' USING ERRCODE = '42501';
  END IF;

  IF target_stripe_customer_id !~ '^cus_[A-Za-z0-9]+$' THEN
    RAISE EXCEPTION 'invalid Stripe customer identifier' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.stripe_customers (organization_id, stripe_customer_id)
  VALUES (target_organization_id, target_stripe_customer_id)
  ON CONFLICT (organization_id) DO UPDATE
  SET updated_at = now()
  WHERE public.stripe_customers.stripe_customer_id = EXCLUDED.stripe_customer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'organization already has a different Stripe customer'
      USING ERRCODE = '23505';
  END IF;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.register_stripe_customer(uuid, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.register_stripe_customer(uuid, text) TO authenticated;
