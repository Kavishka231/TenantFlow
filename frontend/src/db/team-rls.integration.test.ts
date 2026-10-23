import { createHash, randomUUID } from "node:crypto";

import { config as loadEnv } from "dotenv";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

loadEnv({ path: ".env.test.local", quiet: true });

const integrationEnvResult = z
  .object({
    DATABASE_URL: z.string().startsWith("postgresql://"),
    MIGRATION_DATABASE_URL: z.string().startsWith("postgresql://"),
    RLS_TEST_OWNER_ID: z.uuid(),
    RLS_TEST_ADMIN_ID: z.uuid(),
    RLS_TEST_MEMBER_ID: z.uuid(),
    RLS_TEST_OUTSIDER_ID: z.uuid(),
  })
  .safeParse(process.env);

const describeWithDatabase = integrationEnvResult.success ? describe : describe.skip;

describeWithDatabase("PostgreSQL team-management RLS", () => {
  if (!integrationEnvResult.success) {
    return;
  }

  const env = integrationEnvResult.data;
  const runtimeSql = postgres(env.DATABASE_URL, { max: 1, prepare: false });
  const fixtureSql = postgres(env.MIGRATION_DATABASE_URL, {
    max: 1,
    prepare: false,
  });
  const organizationId = randomUUID();
  let outsiderEmail = "";

  type RuntimeTransaction = postgres.TransactionSql;

  function hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  async function asUser<T>(
    userId: string,
    operation: (transaction: RuntimeTransaction) => Promise<T>,
  ) {
    return runtimeSql.begin(async (transaction) => {
      const claims = JSON.stringify({ sub: userId, role: "authenticated" });
      await transaction`
        select
          set_config('request.jwt.claim.sub', ${userId}, true),
          set_config('request.jwt.claims', ${claims}, true)
      `;
      return operation(transaction);
    });
  }

  beforeAll(async () => {
    const [runtimeRole] = await runtimeSql<
      { authenticated: boolean; bypassRls: boolean; superuser: boolean }[]
    >`
      select
        pg_has_role(current_user, 'authenticated', 'member') as authenticated,
        rolbypassrls as "bypassRls",
        rolsuper as superuser
      from pg_roles
      where rolname = current_user
    `;
    expect(runtimeRole).toEqual({
      authenticated: true,
      bypassRls: false,
      superuser: false,
    });

    const [outsider] = await fixtureSql<
      { email: string | null; emailConfirmedAt: Date | null }[]
    >`
      select email, email_confirmed_at as "emailConfirmedAt"
      from auth.users
      where id = ${env.RLS_TEST_OUTSIDER_ID}
    `;
    if (!outsider?.email || !outsider.emailConfirmedAt) {
      throw new Error("The outsider RLS identity must have a confirmed email.");
    }
    outsiderEmail = outsider.email.toLowerCase();

    await fixtureSql`
      insert into public.organizations (id, name, slug, created_by)
      values (
        ${organizationId},
        'Team RLS Organization',
        ${`team-rls-${organizationId}`},
        ${env.RLS_TEST_OWNER_ID}
      )
    `;
    await fixtureSql`
      insert into public.organization_members (organization_id, user_id, role)
      values
        (${organizationId}, ${env.RLS_TEST_OWNER_ID}, 'owner'),
        (${organizationId}, ${env.RLS_TEST_ADMIN_ID}, 'admin'),
        (${organizationId}, ${env.RLS_TEST_MEMBER_ID}, 'member')
    `;
  });

  afterAll(async () => {
    await fixtureSql`
      delete from public.organizations where id = ${organizationId}
    `;
    await Promise.all([runtimeSql.end(), fixtureSql.end()]);
  });

  it("enforces invitation permissions for owner, admin, and member", async () => {
    const ownerInvitation = await asUser(env.RLS_TEST_OWNER_ID, (transaction) =>
      transaction<{ id: string }[]>`
        select public.create_organization_invitation(
          ${organizationId},
          ${`admin-${randomUUID()}@example.com`},
          'admin',
          ${hashToken(randomUUID())},
          now() + interval '7 days'
        )::text as id
      `,
    );
    expect(ownerInvitation).toHaveLength(1);

    const adminInvitation = await asUser(env.RLS_TEST_ADMIN_ID, (transaction) =>
      transaction<{ id: string }[]>`
        select public.create_organization_invitation(
          ${organizationId},
          ${`member-${randomUUID()}@example.com`},
          'member',
          ${hashToken(randomUUID())},
          now() + interval '7 days'
        )::text as id
      `,
    );
    expect(adminInvitation).toHaveLength(1);

    await expect(
      asUser(env.RLS_TEST_ADMIN_ID, (transaction) =>
        transaction`
          select public.create_organization_invitation(
            ${organizationId},
            ${`forbidden-admin-${randomUUID()}@example.com`},
            'admin',
            ${hashToken(randomUUID())},
            now() + interval '7 days'
          )
        `,
      ),
    ).rejects.toMatchObject({ code: "42501" });

    await expect(
      asUser(env.RLS_TEST_MEMBER_ID, (transaction) =>
        transaction`
          select public.create_organization_invitation(
            ${organizationId},
            ${`forbidden-${randomUUID()}@example.com`},
            'member',
            ${hashToken(randomUUID())},
            now() + interval '7 days'
          )
        `,
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("accepts a matching verified email once and blocks replay", async () => {
    const token = randomUUID();
    const tokenHash = hashToken(token);

    await asUser(env.RLS_TEST_OWNER_ID, (transaction) =>
      transaction`
        select public.create_organization_invitation(
          ${organizationId}, ${outsiderEmail}, 'member', ${tokenHash},
          now() + interval '7 days'
        )
      `,
    );

    const accepted = await asUser(env.RLS_TEST_OUTSIDER_ID, (transaction) =>
      transaction`
        select * from public.accept_organization_invitation(${tokenHash})
      `,
    );
    expect(accepted).toHaveLength(1);

    await expect(
      asUser(env.RLS_TEST_OUTSIDER_ID, (transaction) =>
        transaction`
          select * from public.accept_organization_invitation(${tokenHash})
        `,
      ),
    ).rejects.toMatchObject({ code: "P0001" });
  });

  it("rejects expired invitations", async () => {
    const tokenHash = hashToken(`expired-${randomUUID()}`);
    await fixtureSql`
      insert into public.organization_invitations (
        organization_id, email, role, token_hash, invited_by,
        created_at, expires_at
      ) values (
        ${organizationId}, ${outsiderEmail}, 'member', ${tokenHash},
        ${env.RLS_TEST_OWNER_ID}, now() - interval '2 days',
        now() - interval '1 day'
      )
    `;

    await expect(
      asUser(env.RLS_TEST_OUTSIDER_ID, (transaction) =>
        transaction`
          select * from public.accept_organization_invitation(${tokenHash})
        `,
      ),
    ).rejects.toMatchObject({ code: "P0001" });
  });

  it("isolates audit events and prevents runtime tampering", async () => {
    const ownerEvents = await asUser(env.RLS_TEST_OWNER_ID, (transaction) =>
      transaction<{ id: string }[]>`
        select id::text from public.audit_events
        where organization_id = ${organizationId}
      `,
    );
    const memberEvents = await asUser(env.RLS_TEST_MEMBER_ID, (transaction) =>
      transaction`
        select id from public.audit_events
        where organization_id = ${organizationId}
      `,
    );

    expect(ownerEvents.length).toBeGreaterThan(0);
    expect(memberEvents).toHaveLength(0);

    await expect(
      asUser(env.RLS_TEST_OWNER_ID, (transaction) =>
        transaction`
          delete from public.audit_events
          where organization_id = ${organizationId}
        `,
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("transfers ownership atomically and retains a final owner", async () => {
    const transferred = await asUser(env.RLS_TEST_OWNER_ID, (transaction) =>
      transaction<{ changed: boolean }[]>`
        select public.transfer_organization_ownership(
          ${organizationId}, ${env.RLS_TEST_MEMBER_ID}
        ) as changed
      `,
    );
    expect(transferred[0]?.changed).toBe(true);

    const restored = await asUser(env.RLS_TEST_MEMBER_ID, (transaction) =>
      transaction<{ changed: boolean }[]>`
        select public.transfer_organization_ownership(
          ${organizationId}, ${env.RLS_TEST_OWNER_ID}
        ) as changed
      `,
    );
    expect(restored[0]?.changed).toBe(true);

    await expect(
      asUser(env.RLS_TEST_OWNER_ID, (transaction) =>
        transaction`
          update public.organization_members
          set role = 'admin'
          where organization_id = ${organizationId}
            and user_id = ${env.RLS_TEST_OWNER_ID}
        `,
      ),
    ).rejects.toMatchObject({ code: "P0001" });
  });
});
