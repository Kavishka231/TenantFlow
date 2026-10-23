import type { OrganizationRole } from "@/lib/organizations/permissions";

type MembershipContext = {
  actorId: string;
  actorRole: OrganizationRole;
  targetRole: OrganizationRole;
  targetUserId: string;
};

export function canChangeMemberRole(context: MembershipContext) {
  return (
    context.actorRole === "owner" &&
    context.actorId !== context.targetUserId &&
    context.targetRole !== "owner"
  );
}

export function canRemoveMember(context: MembershipContext) {
  return (
    context.actorId !== context.targetUserId &&
    (context.actorRole === "owner" ||
      (context.actorRole === "admin" && context.targetRole === "member"))
  );
}

export function canTransferOwnership(context: MembershipContext) {
  return canChangeMemberRole(context);
}
