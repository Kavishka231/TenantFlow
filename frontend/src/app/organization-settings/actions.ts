"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { updateOrganizationThroughBackend } from "@/lib/backend/organizations";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { updateOrganizationSchema } from "@/lib/organizations/validation";
import type { TeamActionState } from "@/lib/team/action-state";
import { createClient } from "@/lib/supabase/server";

export async function updateOrganizationAction(
  _previousState: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const result = updateOrganizationSchema.safeParse({
    name: formData.get("name"),
    organizationId: formData.get("organizationId"),
  });

  if (!result.success) {
    return {
      message: result.error.issues[0]?.message ?? "Check the organization settings.",
      status: "error",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    await requireOrganizationPermission(
      user.id,
      result.data.organizationId,
      "update_organization",
    );
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const updated = await updateOrganizationThroughBackend(
      user.id,
      session?.access_token,
      result.data,
    );

    if (!updated) {
      return { message: "The organization was not updated.", status: "error" };
    }

    revalidatePath("/dashboard");
    revalidatePath(`/organizations/${result.data.organizationId}/settings`);
    return { message: "Organization settings updated.", status: "success" };
  } catch {
    return { message: "You cannot update this organization.", status: "error" };
  }
}
