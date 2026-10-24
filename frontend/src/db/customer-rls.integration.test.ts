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

describeWithDatabase("PostgreSQL customer RLS", () => {
  if (!integrationEnvResult.success) return;

  const env = integrationEnvResult.data;
  const runtimeSql = postgres(env.DATABASE_URL, { max: 1, prepare: false });
  const fixtureSql = postgres(env.MIGRATION_DATABASE_URL, { max: 1, prepare: false });
  const organizationA = randomUUID();
  const organizationB = randomUUID();
  const customerA = randomUUID();
  const customerB = randomUUID();
  type RuntimeTransaction = postgres.TransactionSql;

  async function asUser<T>(userId: string, operation: (transaction: RuntimeTransaction) => Promise<T>) {
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
    const [runtimeRole] = await runtimeSql<{
      authenticated: boolean;
      bypassRls: boolean;
      ownsCustomers: boolean;
      superuser: boolean;
    }[]>`
      select
        pg_has_role(current_user, 'authenticated', 'member') as authenticated,
        rolbypassrls as "bypassRls",
        exists (
          select 1 from pg_class
          where oid = 'public.customers'::regclass
            and pg_get_userbyid(relowner) = current_user
        ) as "ownsCustomers",
        rolsuper as superuser
      from pg_roles where rolname = current_user
    `;
    expect(runtimeRole).toEqual({
      authenticated: true,
      bypassRls: false,
      ownsCustomers: false,
      superuser: false,
    });

    await fixtureSql`
      insert into public.organizations (id, name, slug, created_by)
      values
        (${organizationA}, 'Customer RLS A', ${`customer-a-${organizationA}`}, ${env.RLS_TEST_OWNER_ID}),
        (${organizationB}, 'Customer RLS B', ${`customer-b-${organizationB}`}, ${env.RLS_TEST_OUTSIDER_ID})
    `;
    await fixtureSql`
      insert into public.organization_members (organization_id, user_id, role)
      values
        (${organizationA}, ${env.RLS_TEST_OWNER_ID}, 'owner'),
        (${organizationA}, ${env.RLS_TEST_ADMIN_ID}, 'admin'),
        (${organizationA}, ${env.RLS_TEST_MEMBER_ID}, 'member'),
        (${organizationB}, ${env.RLS_TEST_OUTSIDER_ID}, 'owner')
    `;
    await fixtureSql`
      insert into public.customers (
        id, organization_id, name, status, created_by, updated_by
      ) values
        (${customerA}, ${organizationA}, 'Tenant A Customer', 'lead', ${env.RLS_TEST_OWNER_ID}, ${env.RLS_TEST_OWNER_ID}),
        (${customerB}, ${organizationB}, 'Tenant B Customer', 'active', ${env.RLS_TEST_OUTSIDER_ID}, ${env.RLS_TEST_OUTSIDER_ID})
    `;
  });

  afterAll(async () => {
    await fixtureSql`
      delete from public.organizations where id in (${organizationA}, ${organizationB})
    `;
    await Promise.all([runtimeSql.end(), fixtureSql.end()]);
  });

  it("allows members to read only their organization's customers", async () => {
    const rows = await asUser(env.RLS_TEST_MEMBER_ID, (transaction) =>
      transaction<{ id: string }[]>`
        select id::text from public.customers
        where id in (${customerA}, ${customerB})
        order by id
      `,
    );
    const outsiderRows = await asUser(env.RLS_TEST_OUTSIDER_ID, (transaction) =>
      transaction`
        select id from public.customers where id = ${customerA}
      `,
    );

    expect(rows.map(({ id }) => id)).toEqual([customerA]);
    expect(outsiderRows).toHaveLength(0);
  });

  it("denies member customer creation, updates, and deletes", async () => {
    await expect(
      asUser(env.RLS_TEST_MEMBER_ID, (transaction) =>
        transaction`
          insert into public.customers (
            organization_id, name, created_by, updated_by
          ) values (
            ${organizationA}, 'Forbidden', ${env.RLS_TEST_MEMBER_ID}, ${env.RLS_TEST_MEMBER_ID}
          )
        `,
      ),
    ).rejects.toMatchObject({ code: "42501" });

    const updated = await asUser(env.RLS_TEST_MEMBER_ID, (transaction) =>
      transaction`
        update public.customers set name = 'Forbidden update'
        where id = ${customerA} returning id
      `,
    );
    const deleted = await asUser(env.RLS_TEST_MEMBER_ID, (transaction) =>
      transaction`
        delete from public.customers where id = ${customerA} returning id
      `,
    );
    expect(updated).toHaveLength(0);
    expect(deleted).toHaveLength(0);
  });

  it("prevents managers from writing into another tenant", async () => {
    await expect(
      asUser(env.RLS_TEST_OWNER_ID, (transaction) =>
        transaction`
          insert into public.customers (
            organization_id, name, created_by, updated_by
          ) values (
            ${organizationB}, 'Cross tenant', ${env.RLS_TEST_OWNER_ID}, ${env.RLS_TEST_OWNER_ID}
          )
        `,
      ),
    ).rejects.toMatchObject({ code: "42501" });

    const crossTenantUpdate = await asUser(env.RLS_TEST_OWNER_ID, (transaction) =>
      transaction`
        update public.customers set name = 'Cross tenant update'
        where id = ${customerB} returning id
      `,
    );
    expect(crossTenantUpdate).toHaveLength(0);
  });

  it("allows admins to create, update, and delete customers", async () => {
    const disposableId = randomUUID();
    const result = await asUser(env.RLS_TEST_ADMIN_ID, async (transaction) => {
      await transaction`
        insert into public.customers (
          id, organization_id, name, status, created_by, updated_by
        ) values (
          ${disposableId}, ${organizationA}, 'Admin Customer', 'lead',
          ${env.RLS_TEST_ADMIN_ID}, ${env.RLS_TEST_ADMIN_ID}
        )
      `;
      const updated = await transaction<{ version: number }[]>`
        update public.customers set status = 'active'
        where id = ${disposableId} returning version
      `;
      const deleted = await transaction`
        delete from public.customers where id = ${disposableId} returning id
      `;
      return { deleted, updated };
    });

    expect(result.updated[0]?.version).toBe(2);
    expect(result.deleted).toHaveLength(1);
  });

  it("protects customer tenant identity fields", async () => {
    await expect(
      asUser(env.RLS_TEST_ADMIN_ID, (transaction) =>
        transaction`
          update public.customers
          set organization_id = ${organizationB}
          where id = ${customerA}
        `,
      ),
    ).rejects.toMatchObject({ code: "P0001" });
  });

  it("records customer activity without allowing audit tampering", async () => {
    const managerEvents = await asUser(env.RLS_TEST_OWNER_ID, (transaction) =>
      transaction<{ eventType: string }[]>`
        select event_type::text as "eventType"
        from public.audit_events
        where organization_id = ${organizationA}
          and event_type::text like 'customer_%'
      `,
    );
    const memberEvents = await asUser(env.RLS_TEST_MEMBER_ID, (transaction) =>
      transaction`
        select id from public.audit_events
        where organization_id = ${organizationA}
      `,
    );

    expect(managerEvents.map(({ eventType }) => eventType)).toEqual(
      expect.arrayContaining([
        "customer_created",
        "customer_updated",
        "customer_deleted",
      ]),
    );
    expect(memberEvents).toHaveLength(0);

    await expect(
      asUser(env.RLS_TEST_OWNER_ID, (transaction) =>
        transaction`
          delete from public.audit_events where organization_id = ${organizationA}
        `,
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
