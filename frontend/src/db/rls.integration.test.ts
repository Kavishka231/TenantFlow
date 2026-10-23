import { randomUUID } from "node:crypto";

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

describeWithDatabase("PostgreSQL organization RLS", () => {
  if (!integrationEnvResult.success) {
    return;
  }

  const env = integrationEnvResult.data;
  const runtimeSql = postgres(env.DATABASE_URL, { max: 1, prepare: false });
  const fixtureSql = postgres(env.MIGRATION_DATABASE_URL, {
    max: 1,
    prepare: false,
  });
  const organizationA = randomUUID();
  const organizationB = randomUUID();

  type RuntimeTransaction = postgres.TransactionSql;

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
      {
        isAuthenticatedMember: boolean;
        ownsTenantTable: boolean;
        bypassesRls: boolean;
        isSuperuser: boolean;
      }[]
    >`
      select
        pg_has_role(current_user, 'authenticated', 'member') as "isAuthenticatedMember",
        exists (
          select 1
          from pg_class
          where oid = 'public.organizations'::regclass
            and pg_get_userbyid(relowner) = current_user
        ) as "ownsTenantTable",
        rolbypassrls as "bypassesRls",
        rolsuper as "isSuperuser"
      from pg_roles
      where rolname = current_user
    `;

    expect(runtimeRole).toMatchObject({
      isAuthenticatedMember: true,
      ownsTenantTable: false,
      bypassesRls: false,
      isSuperuser: false,
    });

    const testUserIds = [
      env.RLS_TEST_OWNER_ID,
      env.RLS_TEST_ADMIN_ID,
      env.RLS_TEST_MEMBER_ID,
      env.RLS_TEST_OUTSIDER_ID,
    ];
    const [profileCount] = await fixtureSql<{ count: number }[]>`
      select count(*)::integer as count
      from public.profiles
      where id = any(${testUserIds}::uuid[])
    `;

    if (profileCount.count !== testUserIds.length) {
      throw new Error(
        "Create the four RLS test identities through Supabase Auth before running integration tests.",
      );
    }

    await fixtureSql`
      delete from public.organizations
      where id in (${organizationA}, ${organizationB})
    `;
    await fixtureSql`
      insert into public.organizations (id, name, slug, created_by)
      values
        (${organizationA}, 'RLS Organization A', ${`rls-a-${organizationA}`}, ${env.RLS_TEST_OWNER_ID}),
        (${organizationB}, 'RLS Organization B', ${`rls-b-${organizationB}`}, ${env.RLS_TEST_OUTSIDER_ID})
    `;
    await fixtureSql`
      insert into public.organization_members (organization_id, user_id, role)
      values
        (${organizationA}, ${env.RLS_TEST_OWNER_ID}, 'owner'),
        (${organizationA}, ${env.RLS_TEST_ADMIN_ID}, 'admin'),
        (${organizationA}, ${env.RLS_TEST_MEMBER_ID}, 'member'),
        (${organizationB}, ${env.RLS_TEST_OUTSIDER_ID}, 'owner')
    `;
  });

  afterAll(async () => {
    await fixtureSql`
      delete from public.organizations
      where id in (${organizationA}, ${organizationB})
    `;
    await Promise.all([runtimeSql.end(), fixtureSql.end()]);
  });

  it("isolates organization reads across tenants", async () => {
    const memberRows = await asUser(env.RLS_TEST_MEMBER_ID, (transaction) =>
      transaction<{ id: string }[]>`
        select id::text
        from public.organizations
        where id in (${organizationA}, ${organizationB})
      `,
    );
    const outsiderRows = await asUser(env.RLS_TEST_OUTSIDER_ID, (transaction) =>
      transaction<{ id: string }[]>`
        select id::text
        from public.organizations
        where id = ${organizationA}
      `,
    );

    expect(memberRows.map(({ id }) => id)).toEqual([organizationA]);
    expect(outsiderRows).toHaveLength(0);
  });

  it("denies member updates and deletes", async () => {
    const updates = await asUser(env.RLS_TEST_MEMBER_ID, (transaction) =>
      transaction`
        update public.organizations
        set name = 'Unauthorized update'
        where id = ${organizationA}
        returning id
      `,
    );
    const deletes = await asUser(env.RLS_TEST_MEMBER_ID, (transaction) =>
      transaction`
        delete from public.organizations
        where id = ${organizationA}
        returning id
      `,
    );

    expect(updates).toHaveLength(0);
    expect(deletes).toHaveLength(0);
  });

  it("allows admins to update organizations but not delete them", async () => {
    const updates = await asUser(env.RLS_TEST_ADMIN_ID, (transaction) =>
      transaction`
        update public.organizations
        set name = 'Admin updated organization'
        where id = ${organizationA}
        returning id
      `,
    );
    const deletes = await asUser(env.RLS_TEST_ADMIN_ID, (transaction) =>
      transaction`
        delete from public.organizations
        where id = ${organizationA}
        returning id
      `,
    );

    expect(updates).toHaveLength(1);
    expect(deletes).toHaveLength(0);
  });

  it("prevents admins from granting the owner role", async () => {
    await expect(
      asUser(env.RLS_TEST_ADMIN_ID, (transaction) =>
        transaction`
          insert into public.organization_members (organization_id, user_id, role)
          values (${organizationA}, ${env.RLS_TEST_OUTSIDER_ID}, 'owner')
        `,
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("allows admins to add and remove ordinary members", async () => {
    await asUser(env.RLS_TEST_ADMIN_ID, (transaction) =>
      transaction`
        insert into public.organization_members (organization_id, user_id, role)
        values (${organizationA}, ${env.RLS_TEST_OUTSIDER_ID}, 'member')
      `,
    );
    const deleted = await asUser(env.RLS_TEST_ADMIN_ID, (transaction) =>
      transaction`
        delete from public.organization_members
        where organization_id = ${organizationA}
          and user_id = ${env.RLS_TEST_OUTSIDER_ID}
        returning user_id
      `,
    );

    expect(deleted).toHaveLength(1);
  });

  it("allows owners to change roles while preserving an owner", async () => {
    const promoted = await asUser(env.RLS_TEST_OWNER_ID, (transaction) =>
      transaction`
        update public.organization_members
        set role = 'admin'
        where organization_id = ${organizationA}
          and user_id = ${env.RLS_TEST_MEMBER_ID}
        returning role
      `,
    );

    expect(promoted).toHaveLength(1);

    await expect(
      asUser(env.RLS_TEST_OWNER_ID, (transaction) =>
        transaction`
          update public.organization_members
          set role = 'member'
          where organization_id = ${organizationA}
            and user_id = ${env.RLS_TEST_OWNER_ID}
        `,
      ),
    ).rejects.toMatchObject({ code: "P0001" });
  });

  it("allows owners to create and delete an organization transactionally", async () => {
    const disposableOrganization = randomUUID();

    const deleted = await asUser(env.RLS_TEST_OWNER_ID, async (transaction) => {
      await transaction`
        insert into public.organizations (id, name, slug, created_by)
        values (
          ${disposableOrganization},
          'Disposable organization',
          ${`disposable-${disposableOrganization}`},
          ${env.RLS_TEST_OWNER_ID}
        )
      `;
      await transaction`
        insert into public.organization_members (organization_id, user_id, role)
        values (${disposableOrganization}, ${env.RLS_TEST_OWNER_ID}, 'owner')
      `;
      return transaction`
        delete from public.organizations
        where id = ${disposableOrganization}
        returning id
      `;
    });

    expect(deleted).toHaveLength(1);
  });
});
