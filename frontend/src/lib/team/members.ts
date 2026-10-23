import "server-only";

import { sql } from "drizzle-orm";

import { withUserContext } from "@/db/client";

type MembershipMutation = {
  organizationId: string;
  userId: string;
};

async function callMembershipFunction(
  userId: string,
  functionName:
    | "remove_organization_member"
    | "transfer_organization_ownership",
  input: MembershipMutation,
) {
  return withUserContext(userId, async (transaction) => {
    const result = await transaction.execute<{ changed: boolean }>(sql`
      select ${sql.identifier(functionName)}(
        ${input.organizationId}::uuid,
        ${input.userId}::uuid
      ) as changed
    `);

    return result[0]?.changed ?? false;
  });
}

export function changeMemberRoleForUser(
  userId: string,
  input: MembershipMutation & { role: "admin" | "member" },
) {
  return withUserContext(userId, async (transaction) => {
    const result = await transaction.execute<{ changed: boolean }>(sql`
      select public.change_organization_member_role(
        ${input.organizationId}::uuid,
        ${input.userId}::uuid,
        ${input.role}::public.organization_role
      ) as changed
    `);

    return result[0]?.changed ?? false;
  });
}

export function removeMemberForUser(
  userId: string,
  input: MembershipMutation,
) {
  return callMembershipFunction(userId, "remove_organization_member", input);
}

export function transferOwnershipForUser(
  userId: string,
  input: MembershipMutation,
) {
  return callMembershipFunction(
    userId,
    "transfer_organization_ownership",
    input,
  );
}
