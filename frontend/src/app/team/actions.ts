"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  changeMemberRoleThroughBackend,
  createInvitationThroughBackend,
  removeMemberThroughBackend,
  revokeInvitationThroughBackend,
  transferOwnershipThroughBackend,
} from "@/lib/backend/team";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import type { TeamActionState } from "@/lib/team/action-state";
import {
  DuplicateInvitationError,
} from "@/lib/team/invitations";
import {
  createInvitationSchema,
  changeMemberRoleSchema,
  invitationIdSchema,
  memberMutationSchema,
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

  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { accessToken: session?.access_token, user };
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

  const { accessToken, user } = await getUser();

  try {
    const organization = await requireOrganizationPermission(
      user.id,
      result.data.organizationId,
      "manage_members",
    );
    const invitation = await createInvitationThroughBackend(
      user.id,
      accessToken,
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

  const { accessToken, user } = await getUser();
  await requireOrganizationPermission(user.id, organizationId, "manage_members");
  await revokeInvitationThroughBackend(
    user.id,
    accessToken,
    organizationId,
    invitationId.data,
  );
  revalidatePath(`/organizations/${organizationId}/team`);
}

function teamPath(organizationId: string, result: "updated" | "denied") {
  return `/organizations/${organizationId}/team?teamStatus=${result}`;
}

export async function changeMemberRoleAction(formData: FormData) {
  const result = changeMemberRoleSchema.safeParse({
    organizationId: formData.get("organizationId"),
    role: formData.get("role"),
    userId: formData.get("userId"),
  });

  if (!result.success) {
    redirect("/dashboard");
  }

  const { accessToken, user } = await getUser();
  const organization = await requireOrganizationPermission(
    user.id,
    result.data.organizationId,
    "manage_members",
  );
  const changed =
    organization.role === "owner" &&
    (await changeMemberRoleThroughBackend(user.id, accessToken, result.data));

  revalidatePath(`/organizations/${organization.id}/team`);
  redirect(teamPath(organization.id, changed ? "updated" : "denied"));
}

export async function removeMemberAction(formData: FormData) {
  const result = memberMutationSchema.safeParse({
    organizationId: formData.get("organizationId"),
    userId: formData.get("userId"),
  });

  if (!result.success) {
    redirect("/dashboard");
  }

  const { accessToken, user } = await getUser();
  const organization = await requireOrganizationPermission(
    user.id,
    result.data.organizationId,
    "manage_members",
  );
  const changed = await removeMemberThroughBackend(
    user.id,
    accessToken,
    result.data,
  );

  revalidatePath(`/organizations/${organization.id}/team`);
  redirect(teamPath(organization.id, changed ? "updated" : "denied"));
}

export async function transferOwnershipAction(formData: FormData) {
  const result = memberMutationSchema.safeParse({
    organizationId: formData.get("organizationId"),
    userId: formData.get("userId"),
  });

  if (!result.success) {
    redirect("/dashboard");
  }

  const { accessToken, user } = await getUser();
  const organization = await requireOrganizationPermission(
    user.id,
    result.data.organizationId,
    "manage_members",
  );
  const changed =
    organization.role === "owner" &&
    (await transferOwnershipThroughBackend(user.id, accessToken, result.data));

  revalidatePath(`/organizations/${organization.id}/team`);
  redirect(teamPath(organization.id, changed ? "updated" : "denied"));
}
