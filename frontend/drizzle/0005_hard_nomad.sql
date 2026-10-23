CREATE TYPE "public"."audit_event_type" AS ENUM('invitation_created', 'invitation_revoked', 'invitation_accepted', 'member_role_changed', 'member_removed', 'ownership_transferred', 'organization_updated');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"event_type" "audit_event_type" NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_organization_created_idx" ON "audit_events" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("actor_id");
--> statement-breakpoint
ALTER TABLE public.audit_events FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE public.audit_events FROM anon;
--> statement-breakpoint
REVOKE ALL ON TABLE public.audit_events FROM authenticated;
--> statement-breakpoint
GRANT SELECT ON TABLE public.audit_events TO authenticated;
--> statement-breakpoint
CREATE POLICY "audit_events_select_manager"
ON public.audit_events FOR SELECT TO authenticated
USING (
  public.has_organization_role(
    organization_id,
    ARRAY['owner', 'admin']::public.organization_role[]
  )
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.audit_invitation_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_events (
      organization_id, actor_id, event_type, metadata
    ) VALUES (
      NEW.organization_id,
      NEW.invited_by,
      'invitation_created',
      pg_catalog.jsonb_build_object(
        'invitationId', NEW.id::text,
        'role', NEW.role::text
      )
    );
  ELSIF OLD.accepted_at IS NULL AND NEW.accepted_at IS NOT NULL THEN
    INSERT INTO public.audit_events (
      organization_id, actor_id, event_type, metadata
    ) VALUES (
      NEW.organization_id,
      NEW.accepted_by,
      'invitation_accepted',
      pg_catalog.jsonb_build_object(
        'invitationId', NEW.id::text,
        'role', NEW.role::text
      )
    );
  ELSIF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
    INSERT INTO public.audit_events (
      organization_id, actor_id, event_type, metadata
    ) VALUES (
      NEW.organization_id,
      NEW.revoked_by,
      'invitation_revoked',
      pg_catalog.jsonb_build_object(
        'invitationId', NEW.id::text,
        'role', NEW.role::text
      )
    );
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER organization_invitations_audit
AFTER INSERT OR UPDATE ON public.organization_invitations
FOR EACH ROW EXECUTE FUNCTION public.audit_invitation_change();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.audit_membership_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
BEGIN
  IF actor_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_events (
      organization_id, actor_id, event_type, metadata
    ) VALUES (
      OLD.organization_id,
      actor_id,
      'member_removed',
      pg_catalog.jsonb_build_object(
        'removedUserId', OLD.user_id::text,
        'previousRole', OLD.role::text
      )
    );
    RETURN OLD;
  END IF;

  IF OLD.role IS DISTINCT FROM NEW.role THEN
    INSERT INTO public.audit_events (
      organization_id, actor_id, event_type, metadata
    ) VALUES (
      NEW.organization_id,
      actor_id,
      'member_role_changed',
      pg_catalog.jsonb_build_object(
        'userId', NEW.user_id::text,
        'previousRole', OLD.role::text,
        'newRole', NEW.role::text
      )
    );

    IF OLD.user_id = actor_id AND OLD.role = 'owner' AND NEW.role = 'admin' THEN
      INSERT INTO public.audit_events (
        organization_id, actor_id, event_type, metadata
      ) VALUES (
        NEW.organization_id,
        actor_id,
        'ownership_transferred',
        pg_catalog.jsonb_build_object('previousOwnerId', actor_id::text)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER organization_members_audit
AFTER UPDATE OR DELETE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.audit_membership_change();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.audit_organization_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
BEGIN
  IF actor_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.name IS DISTINCT FROM NEW.name OR OLD.slug IS DISTINCT FROM NEW.slug THEN
    INSERT INTO public.audit_events (
      organization_id, actor_id, event_type, metadata
    ) VALUES (
      NEW.id,
      actor_id,
      'organization_updated',
      pg_catalog.jsonb_build_object(
        'nameChanged', (OLD.name IS DISTINCT FROM NEW.name)::text,
        'slugChanged', (OLD.slug IS DISTINCT FROM NEW.slug)::text
      )
    );
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER organizations_audit
AFTER UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.audit_organization_change();
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.audit_invitation_change() FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.audit_membership_change() FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.audit_organization_change() FROM PUBLIC;
