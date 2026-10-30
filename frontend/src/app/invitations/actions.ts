"use server";

import { redirect } from "next/navigation";

import { acceptInvitationThroughBackend } from "@/lib/backend/team";
import { setSelectedWorkspace } from "@/lib/organizations/workspace";
import {
  InvalidInvitationError,
} from "@/lib/team/acceptance";
import type { TeamActionState } from "@/lib/team/action-state";
import { invitationTokenSchema } from "@/lib/team/validation";
import { createClient } from "@/lib/supabase/server";

export async function acceptInvitationAction(
  _previousState: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const tokenResult = invitationTokenSchema.safeParse(formData.get("token"));

  if (!tokenResult.success) {
    return { message: "The invitation link is invalid.", status: "error" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/invitations/accept?token=${tokenResult.data}`)}`,
    );
  }

  if (!user.email || !user.email_confirmed_at) {
    return {
      message: "Confirm your email address before accepting this invitation.",
      status: "error",
    };
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const invitation = await acceptInvitationThroughBackend(
      user.id,
      session?.access_token,
      tokenResult.data,
    );
    await setSelectedWorkspace(invitation.organizationId);
  } catch (error) {
    return {
      message:
        error instanceof InvalidInvitationError
          ? error.message
          : "The invitation could not be accepted.",
      status: "error",
    };
  }

  redirect("/dashboard?invitation=accepted");
}
