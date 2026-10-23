DROP POLICY IF EXISTS "memberships_insert_owner_or_manager" ON public.organization_members;--> statement-breakpoint
DROP POLICY IF EXISTS "memberships_update_owner" ON public.organization_members;--> statement-breakpoint
DROP POLICY IF EXISTS "memberships_delete_owner" ON public.organization_members;--> statement-breakpoint

CREATE POLICY "memberships_insert_manager"
ON public.organization_members FOR INSERT TO authenticated
WITH CHECK (
  public.has_organization_role(organization_id, ARRAY['owner']::public.organization_role[])
  OR (
    public.has_organization_role(organization_id, ARRAY['admin']::public.organization_role[])
    AND role IN ('admin', 'member')
  )
  OR (
    user_id = (SELECT auth.uid())
    AND role = 'owner'
    AND public.is_organization_creator(organization_id)
  )
);--> statement-breakpoint

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
    role IN ('admin', 'member')
    AND public.has_organization_role(organization_id, ARRAY['admin']::public.organization_role[])
  )
);--> statement-breakpoint

CREATE POLICY "memberships_delete_manager"
ON public.organization_members FOR DELETE TO authenticated
USING (
  user_id <> (SELECT auth.uid())
  AND (
    public.has_organization_role(organization_id, ARRAY['owner']::public.organization_role[])
    OR (
      role = 'member'
      AND public.has_organization_role(organization_id, ARRAY['admin']::public.organization_role[])
    )
  )
);--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.protect_membership_identity_and_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'membership identity fields are immutable';
  END IF;

  IF OLD.role = 'owner' AND NEW.role <> 'owner' AND NOT EXISTS (
    SELECT 1
    FROM public.organization_members AS other_owner
    WHERE other_owner.organization_id = OLD.organization_id
      AND other_owner.user_id <> OLD.user_id
      AND other_owner.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'an organization must retain at least one owner';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.protect_membership_identity_and_ownership() FROM PUBLIC;--> statement-breakpoint

CREATE TRIGGER organization_members_protect_identity_and_ownership
BEFORE UPDATE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.protect_membership_identity_and_ownership();
