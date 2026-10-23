"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import type { TeamActionState } from "@/lib/team/action-state";
import {
  createInvitationForUser,
  DuplicateInvitationError,
  revokeInvitationForUser,
} from "@/lib/team/invitations";
import {
  createInvitationSchema,
  invitationIdSchema,
} from "@/lib/team/validation";
import { createClient } from "@/lib/supabase/server";

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function createInvitationAction(
  _previousState: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const result = createInvitationSchema.safeParse({
    email: formData.get("email"),
    organizationId: formData.get("organizationId"),
    role: formData.get("role"),
  });

  if (!result.success) {
    return {
      message: result.error.issues[0]?.message ?? "Check the invitation details.",
      status: "error",
    };
  }

  const user = await getUser();

  try {
    const organization = await requireOrganizationPermission(
      user.id,
      result.data.organizationId,
      "manage_members",
    );
    const invitation = await createInvitationForUser(
      user.id,
      organization.name,
      result.data,
    );

    revalidatePath(`/organizations/${organization.id}/team`);

    if (!invitation.delivery.delivered) {
      return {
        message:
          invitation.delivery.channel === "delivery-error"
            ? "Invitation created, but delivery failed. Revoke it before trying again."
            : "Invitation created. Configure delivery or the development outbox to send its link.",
        status: "success",
      };
    }

    return { message: "Invitation sent securely.", status: "success" };
  } catch (error) {
    return {
      message:
        error instanceof DuplicateInvitationError
          ? error.message
          : "You cannot create this invitation.",
      status: "error",
    };
  }
}

export async function revokeInvitationAction(formData: FormData) {
  const organizationId = formData.get("organizationId");
  const invitationId = invitationIdSchema.safeParse(formData.get("invitationId"));

  if (typeof organizationId !== "string" || !invitationId.success) {
    return;
  }

  const user = await getUser();
  await requireOrganizationPermission(user.id, organizationId, "manage_members");
  await revokeInvitationForUser(user.id, invitationId.data);
  revalidatePath(`/organizations/${organizationId}/team`);
}
