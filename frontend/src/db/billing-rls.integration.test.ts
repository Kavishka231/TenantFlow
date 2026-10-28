import { randomUUID } from "node:crypto";

import { config as loadEnv } from "dotenv";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

loadEnv({ path: ".env.test.local", quiet: true });

const result = z.object({
  DATABASE_URL: z.string().startsWith("postgresql://"),
  MIGRATION_DATABASE_URL: z.string().startsWith("postgresql://"),
  RLS_TEST_OWNER_ID: z.uuid(), RLS_TEST_ADMIN_ID: z.uuid(),
  RLS_TEST_MEMBER_ID: z.uuid(), RLS_TEST_OUTSIDER_ID: z.uuid(),
}).safeParse(process.env);
const describeWithDatabase = result.success ? describe : describe.skip;

describeWithDatabase("PostgreSQL subscription billing RLS", () => {
  if (!result.success) return;
  const env = result.data;
  const runtime = postgres(env.DATABASE_URL, { max: 1, prepare: false });
  const fixtures = postgres(env.MIGRATION_DATABASE_URL, { max: 1, prepare: false });
  const organizationA = randomUUID(); const organizationB = randomUUID();
  type Tx = postgres.TransactionSql;
  const asUser = <T>(userId: string, work: (tx: Tx) => Promise<T>) => runtime.begin(async tx => {
    const claims = JSON.stringify({ sub: userId, role: "authenticated" });
    await tx`select set_config('request.jwt.claim.sub', ${userId}, true), set_config('request.jwt.claims', ${claims}, true)`;
    return work(tx);
  });

  beforeAll(async () => {
    const [role] = await runtime<{ authenticated: boolean; bypass: boolean; owner: boolean; superuser: boolean }[]>`
      select pg_has_role(current_user, 'authenticated', 'member') authenticated,
        rolbypassrls bypass, rolsuper superuser,
        exists(select 1 from pg_class where oid='public.organization_subscriptions'::regclass and pg_get_userbyid(relowner)=current_user) owner
      from pg_roles where rolname=current_user`;
    expect(role).toEqual({ authenticated: true, bypass: false, owner: false, superuser: false });
    await fixtures`insert into public.organizations(id,name,slug,created_by) values
      (${organizationA},'Billing RLS A',${`billing-a-${organizationA}`},${env.RLS_TEST_OWNER_ID}),
      (${organizationB},'Billing RLS B',${`billing-b-${organizationB}`},${env.RLS_TEST_OUTSIDER_ID})`;
    await fixtures`insert into public.organization_members(organization_id,user_id,role) values
      (${organizationA},${env.RLS_TEST_OWNER_ID},'owner'),(${organizationA},${env.RLS_TEST_ADMIN_ID},'admin'),
      (${organizationA},${env.RLS_TEST_MEMBER_ID},'member'),(${organizationB},${env.RLS_TEST_OUTSIDER_ID},'owner')`;
    await fixtures`insert into public.stripe_customers(organization_id,stripe_customer_id) values
      (${organizationA},${`cus_A${organizationA.replaceAll("-", "")}`}),(${organizationB},${`cus_B${organizationB.replaceAll("-", "")}`})`;
    await fixtures`insert into public.organization_subscriptions(
      organization_id,plan_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,status
    ) values (${organizationA},'10000000-0000-4000-8000-000000000002',${`cus_A${organizationA.replaceAll("-", "")}`},${`sub_A${organizationA.replaceAll("-", "")}`},'price_TestStarter','active')`;
  });
  afterAll(async () => {
    await fixtures`delete from public.organizations where id in (${organizationA},${organizationB})`;
    await Promise.all([runtime.end(), fixtures.end()]);
  });

  it("shows billing records only to the organization owner", async () => {
    const ownerRows = await asUser(env.RLS_TEST_OWNER_ID, tx => tx`select organization_id from public.organization_subscriptions where organization_id=${organizationA}`);
    const adminRows = await asUser(env.RLS_TEST_ADMIN_ID, tx => tx`select organization_id from public.organization_subscriptions where organization_id=${organizationA}`);
    const outsiderRows = await asUser(env.RLS_TEST_OUTSIDER_ID, tx => tx`select organization_id from public.organization_subscriptions where organization_id=${organizationA}`);
    expect(ownerRows).toHaveLength(1); expect(adminRows).toHaveLength(0); expect(outsiderRows).toHaveLength(0);
  });

  it("returns safe entitlements to members without exposing Stripe IDs", async () => {
    const rows = await asUser(env.RLS_TEST_MEMBER_ID, tx => tx<{ planKey: string }[]>`select plan_key as "planKey" from public.get_organization_entitlements(${organizationA})`);
    expect(rows).toEqual([{ planKey: "starter" }]);
    await expect(asUser(env.RLS_TEST_OUTSIDER_ID, tx => tx`select * from public.get_organization_entitlements(${organizationA})`)).rejects.toMatchObject({ code: "42501" });
  });

  it("denies direct billing mutations and webhook RPC access", async () => {
    await expect(asUser(env.RLS_TEST_OWNER_ID, tx => tx`delete from public.organization_subscriptions where organization_id=${organizationA}`)).rejects.toMatchObject({ code: "42501" });
    await expect(asUser(env.RLS_TEST_OWNER_ID, tx => tx`select public.process_stripe_subscription_event(
      'evt_Forbidden','customer.subscription.updated',${organizationA},'starter',${`cus_A${organizationA.replaceAll("-", "")}`},
      'sub_Forbidden','price_TestStarter','active',false,null,null,null,1,${"a".repeat(64)})`)).rejects.toMatchObject({ code: "42501" });
  });
});
