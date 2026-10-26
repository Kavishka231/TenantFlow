CREATE OR REPLACE FUNCTION public.get_organization_entitlements(target_organization_id uuid)
RETURNS TABLE(plan_key text, max_customers integer, max_invoices integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_organization_member(target_organization_id) THEN
    RAISE EXCEPTION 'organization membership required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.key::text,
    (p.limits->>'maxCustomers')::integer,
    (p.limits->>'maxInvoices')::integer
  FROM public.subscription_plans p
  LEFT JOIN public.organization_subscriptions s
    ON s.organization_id = target_organization_id
    AND s.plan_id = p.id
    AND s.status IN ('active', 'trialing', 'past_due')
  WHERE (s.organization_id IS NOT NULL)
     OR (p.key = 'free' AND NOT EXISTS (
       SELECT 1 FROM public.organization_subscriptions active_s
       WHERE active_s.organization_id = target_organization_id
         AND active_s.status IN ('active', 'trialing', 'past_due')
     ))
  ORDER BY CASE WHEN s.organization_id IS NOT NULL THEN 0 ELSE 1 END
  LIMIT 1;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.get_organization_entitlements(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.get_organization_entitlements(uuid) TO authenticated;
