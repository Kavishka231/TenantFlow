import {
  changeMemberRoleAction,
  removeMemberAction,
  transferOwnershipAction,
} from "@/app/team/actions";
import { Button } from "@/components/ui/button";
import type { TeamMember } from "@/lib/team/list";

export function MemberActions({
  actorId,
  actorRole,
  member,
  organizationId,
}: {
  actorId: string;
  actorRole: "owner" | "admin" | "member";
  member: TeamMember;
  organizationId: string;
}) {
  const isSelf = actorId === member.userId;
  const ownerCanManageRole =
    actorRole === "owner" && !isSelf && member.role !== "owner";
  const canRemove =
    !isSelf &&
    (actorRole === "owner" ||
      (actorRole === "admin" && member.role === "member"));

  if (!ownerCanManageRole && !canRemove) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
      {ownerCanManageRole ? (
        <form action={changeMemberRoleAction} className="flex gap-2">
          <MembershipFields
            organizationId={organizationId}
            userId={member.userId}
          />
          <select
            aria-label={`Role for ${member.fullName ?? "team member"}`}
            name="role"
            defaultValue={member.role}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <Button type="submit" size="sm" variant="outline">
            Save role
          </Button>
        </form>
      ) : null}
      {ownerCanManageRole ? (
        <form action={transferOwnershipAction}>
          <MembershipFields
            organizationId={organizationId}
            userId={member.userId}
          />
          <Button type="submit" size="sm" variant="outline">
            Transfer ownership
          </Button>
        </form>
      ) : null}
      {canRemove ? (
        <form action={removeMemberAction}>
          <MembershipFields
            organizationId={organizationId}
            userId={member.userId}
          />
          <Button type="submit" size="sm" variant="destructive">
            Remove
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function MembershipFields({
  organizationId,
  userId,
}: {
  organizationId: string;
  userId: string;
}) {
  return (
    <>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="userId" value={userId} />
    </>
  );
}
