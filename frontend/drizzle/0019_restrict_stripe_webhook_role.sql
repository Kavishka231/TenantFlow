DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tenantflow_stripe_webhook') THEN
    CREATE ROLE tenantflow_stripe_webhook NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.process_stripe_subscription_event(
  text, text, uuid, text, text, text, text, public.subscription_status,
  boolean, timestamptz, timestamptz, timestamptz, bigint, text
) FROM authenticated;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO tenantflow_stripe_webhook;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.process_stripe_subscription_event(
  text, text, uuid, text, text, text, text, public.subscription_status,
  boolean, timestamptz, timestamptz, timestamptz, bigint, text
) TO tenantflow_stripe_webhook;
