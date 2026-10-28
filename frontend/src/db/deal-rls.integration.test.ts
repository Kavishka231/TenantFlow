import { randomUUID } from "node:crypto";

import { config as loadEnv } from "dotenv";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

loadEnv({ path: ".env.test.local", quiet: true });
const parsed = z.object({ DATABASE_URL: z.string().startsWith("postgresql://"), MIGRATION_DATABASE_URL: z.string().startsWith("postgresql://"), RLS_TEST_OWNER_ID: z.uuid(), RLS_TEST_ADMIN_ID: z.uuid(), RLS_TEST_MEMBER_ID: z.uuid(), RLS_TEST_OUTSIDER_ID: z.uuid() }).safeParse(process.env);
const describeWithDatabase = parsed.success ? describe : describe.skip;

describeWithDatabase("PostgreSQL deal RLS", () => {
  if (!parsed.success) return; const env = parsed.data; const runtime = postgres(env.DATABASE_URL, { max: 1, prepare: false }); const fixtures = postgres(env.MIGRATION_DATABASE_URL, { max: 1, prepare: false });
  const organizationA = randomUUID(), organizationB = randomUUID(), customerA = randomUUID(), customerB = randomUUID(), stageA = randomUUID(), stageB = randomUUID(), dealA = randomUUID();
  type Tx = postgres.TransactionSql;
  const asUser = <T>(id: string, work: (tx: Tx) => Promise<T>) => runtime.begin(async tx => { const claims = JSON.stringify({ sub: id, role: "authenticated" }); await tx`select set_config('request.jwt.claim.sub',${id},true),set_config('request.jwt.claims',${claims},true)`; return work(tx); });
  beforeAll(async () => {
    const [role] = await runtime<{ authenticated: boolean; bypass: boolean; owner: boolean; superuser: boolean }[]>`select pg_has_role(current_user,'authenticated','member') authenticated,rolbypassrls bypass,rolsuper superuser,exists(select 1 from pg_class where oid='public.deals'::regclass and pg_get_userbyid(relowner)=current_user) owner from pg_roles where rolname=current_user`;
    expect(role).toEqual({ authenticated: true, bypass: false, owner: false, superuser: false });
    await fixtures`insert into public.organizations(id,name,slug,created_by) values (${organizationA},'Deals A',${`deals-a-${organizationA}`},${env.RLS_TEST_OWNER_ID}),(${organizationB},'Deals B',${`deals-b-${organizationB}`},${env.RLS_TEST_OUTSIDER_ID})`;
    await fixtures`insert into public.organization_members(organization_id,user_id,role) values (${organizationA},${env.RLS_TEST_OWNER_ID},'owner'),(${organizationA},${env.RLS_TEST_ADMIN_ID},'admin'),(${organizationA},${env.RLS_TEST_MEMBER_ID},'member'),(${organizationB},${env.RLS_TEST_OUTSIDER_ID},'owner')`;
    await fixtures`insert into public.customers(id,organization_id,name,status,created_by,updated_by) values (${customerA},${organizationA},'Deal Customer A','active',${env.RLS_TEST_OWNER_ID},${env.RLS_TEST_OWNER_ID}),(${customerB},${organizationB},'Deal Customer B','active',${env.RLS_TEST_OUTSIDER_ID},${env.RLS_TEST_OUTSIDER_ID})`;
    await fixtures`insert into public.pipeline_stages(id,organization_id,name,color,position,kind) values (${stageA},${organizationA},'Test Lead','#6366F1',100,'open'),(${stageB},${organizationB},'Test Lead','#6366F1',100,'open')`;
    await fixtures`insert into public.deals(id,organization_id,customer_id,stage_id,title,value_minor,currency,created_by,updated_by) values (${dealA},${organizationA},${customerA},${stageA},'Visible deal',10000,'USD',${env.RLS_TEST_OWNER_ID},${env.RLS_TEST_OWNER_ID})`;
  });
  afterAll(async () => { await fixtures`delete from public.organizations where id in (${organizationA},${organizationB})`; await Promise.all([runtime.end(), fixtures.end()]); });

  it("allows MEMBER to read only their organization's deals and activity", async () => {
    const deals = await asUser(env.RLS_TEST_MEMBER_ID, tx => tx`select id from public.deals`); const activity = await asUser(env.RLS_TEST_MEMBER_ID, tx => tx`select type from public.deal_activities where deal_id=${dealA}`);
    expect(deals).toEqual([{ id: dealA }]); expect(activity).toHaveLength(1);
  });
  it("denies MEMBER deal and note mutations", async () => {
    await expect(asUser(env.RLS_TEST_MEMBER_ID, tx => tx`update public.deals set title='Forbidden' where id=${dealA}`)).resolves.toHaveLength(0);
    await expect(asUser(env.RLS_TEST_MEMBER_ID, tx => tx`insert into public.deal_activities(organization_id,deal_id,actor_id,type,note) values (${organizationA},${dealA},${env.RLS_TEST_MEMBER_ID},'note_added','Forbidden')`)).rejects.toMatchObject({ code: "42501" });
  });
  it("allows managers but rejects cross-tenant relationships", async () => {
    const id = randomUUID(); await asUser(env.RLS_TEST_ADMIN_ID, tx => tx`insert into public.deals(id,organization_id,customer_id,stage_id,assigned_user_id,title,value_minor,currency,created_by,updated_by) values (${id},${organizationA},${customerA},${stageA},${env.RLS_TEST_MEMBER_ID},'Admin deal',25000,'USD',${env.RLS_TEST_ADMIN_ID},${env.RLS_TEST_ADMIN_ID})`);
    await expect(asUser(env.RLS_TEST_ADMIN_ID, tx => tx`update public.deals set assigned_user_id=${env.RLS_TEST_OUTSIDER_ID} where id=${id}`)).rejects.toThrow();
    await expect(asUser(env.RLS_TEST_ADMIN_ID, tx => tx`insert into public.deals(organization_id,customer_id,stage_id,title,value_minor,currency,created_by,updated_by) values (${organizationA},${customerB},${stageA},'Cross tenant',1,'USD',${env.RLS_TEST_ADMIN_ID},${env.RLS_TEST_ADMIN_ID})`)).rejects.toThrow();
    await asUser(env.RLS_TEST_ADMIN_ID, tx => tx`delete from public.deals where id=${id}`);
  });
});
