CREATE OR REPLACE FUNCTION public.accept_organization_invitation(
  target_token_hash text
)
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  membership_role public.organization_role
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  actor_email text;
  actor_email_confirmed_at timestamptz;
  invitation public.organization_invitations%ROWTYPE;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF target_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid invitation' USING ERRCODE = 'P0001';
  END IF;

  SELECT lower(auth_user.email), auth_user.email_confirmed_at
  INTO actor_email, actor_email_confirmed_at
  FROM auth.users AS auth_user
  WHERE auth_user.id = actor_id;

  IF actor_email IS NULL OR actor_email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'a verified email is required' USING ERRCODE = '42501';
  END IF;

  SELECT candidate.*
  INTO invitation
  FROM public.organization_invitations AS candidate
  WHERE candidate.token_hash = target_token_hash
  FOR UPDATE;

  IF NOT FOUND
    OR invitation.accepted_at IS NOT NULL
    OR invitation.revoked_at IS NOT NULL
    OR invitation.expires_at <= now()
    OR invitation.email <> actor_email THEN
    RAISE EXCEPTION 'invalid invitation' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organization_members AS membership
    WHERE membership.organization_id = invitation.organization_id
      AND membership.user_id = actor_id
  ) THEN
    RAISE EXCEPTION 'user is already a member' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (invitation.organization_id, actor_id, invitation.role);

  UPDATE public.organization_invitations
  SET accepted_at = now(), accepted_by = actor_id
  WHERE id = invitation.id;

  RETURN QUERY
  SELECT organization.id, organization.name::text, invitation.role
  FROM public.organizations AS organization
  WHERE organization.id = invitation.organization_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.accept_organization_invitation(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.accept_organization_invitation(text) TO authenticated;
