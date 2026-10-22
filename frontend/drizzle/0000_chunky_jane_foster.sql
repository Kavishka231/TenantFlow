CREATE TYPE "public"."organization_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TABLE "organization_members" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "organization_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_members_pkey" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "organization_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(63) NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_name_length" CHECK (char_length("organizations"."name") between 2 and 120),
	CONSTRAINT "organizations_slug_format" CHECK ("organizations"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" varchar(100),
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_full_name_length" CHECK ("profiles"."full_name" is null or char_length("profiles"."full_name") between 1 and 100)
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_members_user_id_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "organization_members_organization_role_idx" ON "organization_members" USING btree ("organization_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_unique" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "organizations_created_by_idx" ON "organizations" USING btree ("created_by");--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_auth_users_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "profiles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organization_members" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint

CREATE TRIGGER organizations_set_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NULLIF(BTRIM(LEFT(NEW.raw_user_meta_data ->> 'full_name', 100)), ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;--> statement-breakpoint

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.is_organization_member(target_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members AS membership
    WHERE membership.organization_id = target_organization_id
      AND membership.user_id = (SELECT auth.uid())
  );
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.has_organization_role(
  target_organization_id uuid,
  allowed_roles public.organization_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members AS membership
    WHERE membership.organization_id = target_organization_id
      AND membership.user_id = (SELECT auth.uid())
      AND membership.role = ANY(allowed_roles)
  );
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.is_organization_creator(target_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organizations AS organization
    WHERE organization.id = target_organization_id
      AND organization.created_by = (SELECT auth.uid())
  );
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.is_organization_member(uuid) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.has_organization_role(uuid, public.organization_role[]) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.is_organization_creator(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.is_organization_member(uuid) TO authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.has_organization_role(uuid, public.organization_role[]) TO authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.is_organization_creator(uuid) TO authenticated;--> statement-breakpoint
REVOKE ALL ON TABLE public.profiles FROM anon;--> statement-breakpoint
REVOKE ALL ON TABLE public.organizations FROM anon;--> statement-breakpoint
REVOKE ALL ON TABLE public.organization_members FROM anon;--> statement-breakpoint
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organizations TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organization_members TO authenticated;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.protect_organization_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'organization identity fields are immutable';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER organizations_protect_identity
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.protect_organization_identity();--> statement-breakpoint

CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = id);--> statement-breakpoint

CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = id)
WITH CHECK ((SELECT auth.uid()) = id);--> statement-breakpoint

CREATE POLICY "organizations_select_member"
ON public.organizations FOR SELECT TO authenticated
USING (public.is_organization_member(id));--> statement-breakpoint

CREATE POLICY "organizations_insert_own"
ON public.organizations FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = created_by);--> statement-breakpoint

CREATE POLICY "organizations_update_manager"
ON public.organizations FOR UPDATE TO authenticated
USING (public.has_organization_role(id, ARRAY['owner', 'admin']::public.organization_role[]))
WITH CHECK (public.has_organization_role(id, ARRAY['owner', 'admin']::public.organization_role[]));--> statement-breakpoint

CREATE POLICY "organizations_delete_owner"
ON public.organizations FOR DELETE TO authenticated
USING (public.has_organization_role(id, ARRAY['owner']::public.organization_role[]));--> statement-breakpoint

CREATE POLICY "memberships_select_member"
ON public.organization_members FOR SELECT TO authenticated
USING (public.is_organization_member(organization_id));--> statement-breakpoint

CREATE POLICY "memberships_insert_owner_or_manager"
ON public.organization_members FOR INSERT TO authenticated
WITH CHECK (
  public.has_organization_role(organization_id, ARRAY['owner', 'admin']::public.organization_role[])
  OR (
    user_id = (SELECT auth.uid())
    AND role = 'owner'
    AND public.is_organization_creator(organization_id)
  )
);--> statement-breakpoint

CREATE POLICY "memberships_update_owner"
ON public.organization_members FOR UPDATE TO authenticated
USING (public.has_organization_role(organization_id, ARRAY['owner']::public.organization_role[]))
WITH CHECK (public.has_organization_role(organization_id, ARRAY['owner']::public.organization_role[]));--> statement-breakpoint

CREATE POLICY "memberships_delete_owner"
ON public.organization_members FOR DELETE TO authenticated
USING (
  user_id <> (SELECT auth.uid())
  AND public.has_organization_role(organization_id, ARRAY['owner']::public.organization_role[])
);
