"use server";

import { redirect } from "next/navigation";

import type { OrganizationActionState } from "@/lib/organizations/action-state";
import {
  createOrganizationForUser,
  OrganizationSlugConflictError,
} from "@/lib/organizations/create";
import { createOrganizationSchema } from "@/lib/organizations/validation";
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
    await createOrganizationForUser(user.id, result.data);
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
