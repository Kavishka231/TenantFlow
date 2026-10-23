CREATE TABLE "organization_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" "organization_role" DEFAULT 'member' NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by" uuid,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_invitations_email_normalized" CHECK ("organization_invitations"."email" = lower(btrim("organization_invitations"."email")) and char_length("organization_invitations"."email") between 3 and 320),
	CONSTRAINT "organization_invitations_role_not_owner" CHECK ("organization_invitations"."role" in ('admin', 'member')),
	CONSTRAINT "organization_invitations_expiry_after_creation" CHECK ("organization_invitations"."expires_at" > "organization_invitations"."created_at"),
	CONSTRAINT "organization_invitations_terminal_state" CHECK (not ("organization_invitations"."accepted_at" is not null and "organization_invitations"."revoked_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "organization_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_invited_by_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_accepted_by_profiles_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_revoked_by_profiles_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_invitations_token_hash_unique" ON "organization_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_invitations_active_email_unique" ON "organization_invitations" USING btree ("organization_id","email") WHERE "organization_invitations"."accepted_at" is null and "organization_invitations"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "organization_invitations_organization_idx" ON "organization_invitations" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "organization_invitations_email_idx" ON "organization_invitations" USING btree ("email");
--> statement-breakpoint
ALTER TABLE public.organization_invitations FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE public.organization_invitations FROM anon;
--> statement-breakpoint
REVOKE ALL ON TABLE public.organization_invitations FROM authenticated;
--> statement-breakpoint
GRANT SELECT ON TABLE public.organization_invitations TO authenticated;
--> statement-breakpoint
CREATE POLICY "invitations_select_manager"
ON public.organization_invitations FOR SELECT TO authenticated
USING (
  public.has_organization_role(
    organization_id,
    ARRAY['owner', 'admin']::public.organization_role[]
  )
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.create_organization_invitation(
  target_organization_id uuid,
  target_email text,
  target_role public.organization_role,
  target_token_hash text,
  target_expires_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  invitation_id uuid;
  normalized_email text := lower(btrim(target_email));
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF target_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'invalid invitation role' USING ERRCODE = '22023';
  END IF;

  IF normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR char_length(normalized_email) > 320 THEN
    RAISE EXCEPTION 'invalid invitation email' USING ERRCODE = '22023';
  END IF;

  IF target_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid invitation token hash' USING ERRCODE = '22023';
  END IF;

  IF target_expires_at <= now() OR target_expires_at > now() + interval '30 days' THEN
    RAISE EXCEPTION 'invalid invitation expiry' USING ERRCODE = '22023';
  END IF;

  IF NOT public.has_organization_role(
    target_organization_id,
    ARRAY['owner', 'admin']::public.organization_role[]
  ) THEN
    RAISE EXCEPTION 'organization access denied' USING ERRCODE = '42501';
  END IF;

  IF target_role = 'admin' AND NOT public.has_organization_role(
    target_organization_id,
    ARRAY['owner']::public.organization_role[]
  ) THEN
    RAISE EXCEPTION 'only owners may invite administrators' USING ERRCODE = '42501';
  END IF;

  UPDATE public.organization_invitations
  SET revoked_at = now(), revoked_by = actor_id
  WHERE organization_id = target_organization_id
    AND email = normalized_email
    AND accepted_at IS NULL
    AND revoked_at IS NULL
    AND expires_at <= now();

  INSERT INTO public.organization_invitations (
    organization_id,
    email,
    role,
    token_hash,
    invited_by,
    expires_at
  )
  VALUES (
    target_organization_id,
    normalized_email,
    target_role,
    target_token_hash,
    actor_id,
    target_expires_at
  )
  RETURNING id INTO invitation_id;

  RETURN invitation_id;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.revoke_organization_invitation(
  target_invitation_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  affected_rows integer;
BEGIN
  UPDATE public.organization_invitations AS invitation
  SET revoked_at = now(), revoked_by = actor_id
  WHERE invitation.id = target_invitation_id
    AND invitation.accepted_at IS NULL
    AND invitation.revoked_at IS NULL
    AND (
      public.has_organization_role(
        invitation.organization_id,
        ARRAY['owner']::public.organization_role[]
      )
      OR (
        invitation.role = 'member'
        AND public.has_organization_role(
          invitation.organization_id,
          ARRAY['admin']::public.organization_role[]
        )
      )
    );

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows = 1;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.create_organization_invitation(uuid, text, public.organization_role, text, timestamptz) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.revoke_organization_invitation(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.create_organization_invitation(uuid, text, public.organization_role, text, timestamptz) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.revoke_organization_invitation(uuid) TO authenticated;
