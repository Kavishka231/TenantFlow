"use server";

import { redirect } from "next/navigation";

import { createOrganizationThroughBackend } from "@/lib/backend/organizations";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import type { OrganizationActionState } from "@/lib/organizations/action-state";
import { OrganizationSlugConflictError } from "@/lib/organizations/create";
import { createOrganizationSchema } from "@/lib/organizations/validation";
import { setSelectedWorkspace } from "@/lib/organizations/workspace";
import { workspaceIdSchema } from "@/lib/organizations/workspace-validation";
import { createClient } from "@/lib/supabase/server";

export async function createOrganizationAction(
  _previousState: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const result = createOrganizationSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
  });

  if (!result.success) {
    return {
      message: result.error.issues[0]?.message ?? "Check the organization details.",
      status: "error",
    };
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const organization = await createOrganizationThroughBackend(
      user.id,
      session?.access_token,
      result.data,
    );
    await setSelectedWorkspace(organization.id);
  } catch (error) {
    if (error instanceof OrganizationSlugConflictError) {
      return { message: error.message, status: "error" };
    }

    return {
      message: "The organization could not be created. Try again.",
      status: "error",
    };
  }

  redirect("/dashboard");
}

export async function switchWorkspaceAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const result = workspaceIdSchema.safeParse(formData.get("organizationId"));

  if (!result.success) {
    redirect("/dashboard?workspaceError=invalid");
  }

  try {
    await requireOrganizationPermission(
      user.id,
      result.data,
      "read_workspace",
    );
  } catch {
    redirect("/dashboard?workspaceError=denied");
  }

  await setSelectedWorkspace(result.data);
  redirect("/dashboard");
}
