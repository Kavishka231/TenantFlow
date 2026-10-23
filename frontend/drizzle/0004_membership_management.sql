DROP TRIGGER IF EXISTS organization_members_protect_identity_and_ownership
ON public.organization_members;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.protect_membership_identity_and_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(OLD.organization_id::text, 0)
  );

  IF TG_OP = 'UPDATE' AND (
    NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
  ) THEN
    RAISE EXCEPTION 'membership identity fields are immutable';
  END IF;

  IF OLD.role = 'owner'
    AND (TG_OP = 'DELETE' OR NEW.role <> 'owner')
    AND NOT EXISTS (
      SELECT 1
      FROM public.organization_members AS other_owner
      WHERE other_owner.organization_id = OLD.organization_id
        AND other_owner.user_id <> OLD.user_id
        AND other_owner.role = 'owner'
    ) THEN
    RAISE EXCEPTION 'an organization must retain at least one owner';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER organization_members_protect_identity_and_ownership
BEFORE UPDATE OR DELETE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.protect_membership_identity_and_ownership();
--> statement-breakpoint
DROP POLICY IF EXISTS "memberships_update_manager" ON public.organization_members;
--> statement-breakpoint
CREATE POLICY "memberships_update_manager"
ON public.organization_members FOR UPDATE TO authenticated
USING (
  public.has_organization_role(organization_id, ARRAY['owner']::public.organization_role[])
  OR (
    role = 'member'
    AND public.has_organization_role(organization_id, ARRAY['admin']::public.organization_role[])
  )
)
WITH CHECK (
  public.has_organization_role(organization_id, ARRAY['owner']::public.organization_role[])
  OR (
    role = 'member'
    AND public.has_organization_role(organization_id, ARRAY['admin']::public.organization_role[])
  )
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.change_organization_member_role(
  target_organization_id uuid,
  target_user_id uuid,
  target_role public.organization_role
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  current_role public.organization_role;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_organization_id::text, 0)
  );

  IF actor_id IS NULL OR NOT public.has_organization_role(
    target_organization_id,
    ARRAY['owner']::public.organization_role[]
  ) THEN
    RAISE EXCEPTION 'organization access denied' USING ERRCODE = '42501';
  END IF;

  IF target_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'use ownership transfer to grant owner' USING ERRCODE = '22023';
  END IF;

  SELECT membership.role
  INTO current_role
  FROM public.organization_members AS membership
  WHERE membership.organization_id = target_organization_id
    AND membership.user_id = target_user_id
  FOR UPDATE;

  IF NOT FOUND OR current_role = 'owner' OR target_user_id = actor_id THEN
    RETURN false;
  END IF;

  UPDATE public.organization_members
  SET role = target_role
  WHERE organization_id = target_organization_id
    AND user_id = target_user_id;

  RETURN true;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.remove_organization_member(
  target_organization_id uuid,
  target_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
  target_membership_role public.organization_role;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_organization_id::text, 0)
  );

  IF actor_id IS NULL OR target_user_id = actor_id THEN
    RETURN false;
  END IF;

  SELECT membership.role
  INTO target_membership_role
  FROM public.organization_members AS membership
  WHERE membership.organization_id = target_organization_id
    AND membership.user_id = target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF NOT (
    public.has_organization_role(
      target_organization_id,
      ARRAY['owner']::public.organization_role[]
    )
    OR (
      target_membership_role = 'member'
      AND public.has_organization_role(
        target_organization_id,
        ARRAY['admin']::public.organization_role[]
      )
    )
  ) THEN
    RAISE EXCEPTION 'organization access denied' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.organization_members
  WHERE organization_id = target_organization_id
    AND user_id = target_user_id;

  RETURN true;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.transfer_organization_ownership(
  target_organization_id uuid,
  target_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := (SELECT auth.uid());
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_organization_id::text, 0)
  );

  IF actor_id IS NULL OR target_user_id = actor_id OR NOT public.has_organization_role(
    target_organization_id,
    ARRAY['owner']::public.organization_role[]
  ) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members AS membership
    WHERE membership.organization_id = target_organization_id
      AND membership.user_id = target_user_id
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.organization_members
  SET role = 'owner'
  WHERE organization_id = target_organization_id
    AND user_id = target_user_id;

  UPDATE public.organization_members
  SET role = 'admin'
  WHERE organization_id = target_organization_id
    AND user_id = actor_id;

  RETURN true;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.change_organization_member_role(uuid, uuid, public.organization_role) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.remove_organization_member(uuid, uuid) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.transfer_organization_ownership(uuid, uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.change_organization_member_role(uuid, uuid, public.organization_role) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.remove_organization_member(uuid, uuid) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.transfer_organization_ownership(uuid, uuid) TO authenticated;
