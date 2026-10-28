import { randomUUID } from "node:crypto";

import { config as loadEnv } from "dotenv";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

loadEnv({ path: ".env.test.local", quiet: true });
const parsed = z.object({ DATABASE_URL: z.string().startsWith("postgresql://"), MIGRATION_DATABASE_URL: z.string().startsWith("postgresql://"), RLS_TEST_OWNER_ID: z.uuid(), RLS_TEST_ADMIN_ID: z.uuid(), RLS_TEST_MEMBER_ID: z.uuid(), RLS_TEST_OUTSIDER_ID: z.uuid() }).safeParse(process.env);
const describeWithDatabase = parsed.success ? describe : describe.skip;

describeWithDatabase("PostgreSQL expense RLS", () => {
  if (!parsed.success) return;
  const env = parsed.data; const runtime = postgres(env.DATABASE_URL, { max: 1, prepare: false }); const fixtures = postgres(env.MIGRATION_DATABASE_URL, { max: 1, prepare: false });
  const organizationA=randomUUID(),organizationB=randomUUID(),categoryA=randomUUID(),categoryB=randomUUID(),expenseA=randomUUID();
  type Tx=postgres.TransactionSql;
  const asUser=<T>(id:string,work:(tx:Tx)=>Promise<T>)=>runtime.begin(async tx=>{const claims=JSON.stringify({sub:id,role:"authenticated"});await tx`select set_config('request.jwt.claim.sub',${id},true),set_config('request.jwt.claims',${claims},true)`;return work(tx);});

  beforeAll(async()=>{
    const[role]=await runtime<{authenticated:boolean;bypass:boolean;owner:boolean;superuser:boolean}[]>`select pg_has_role(current_user,'authenticated','member') authenticated,rolbypassrls bypass,rolsuper superuser,exists(select 1 from pg_class where oid='public.expenses'::regclass and pg_get_userbyid(relowner)=current_user) owner from pg_roles where rolname=current_user`;
    expect(role).toEqual({authenticated:true,bypass:false,owner:false,superuser:false});
    await fixtures`insert into public.organizations(id,name,slug,created_by) values (${organizationA},'Expenses A',${`expenses-a-${organizationA}`},${env.RLS_TEST_OWNER_ID}),(${organizationB},'Expenses B',${`expenses-b-${organizationB}`},${env.RLS_TEST_OUTSIDER_ID})`;
    await fixtures`insert into public.organization_members(organization_id,user_id,role) values (${organizationA},${env.RLS_TEST_OWNER_ID},'owner'),(${organizationA},${env.RLS_TEST_ADMIN_ID},'admin'),(${organizationA},${env.RLS_TEST_MEMBER_ID},'member'),(${organizationB},${env.RLS_TEST_OUTSIDER_ID},'owner')`;
    await fixtures`insert into public.expense_categories(id,organization_id,name,color) values (${categoryA},${organizationA},'Test A','#6366F1'),(${categoryB},${organizationB},'Test B','#10B981')`;
    await fixtures`insert into public.expenses(id,organization_id,category_id,amount_minor,currency,expense_date,vendor,payment_method,status,created_by,updated_by) values (${expenseA},${organizationA},${categoryA},12500,'USD','2026-10-28','Visible Vendor','card','pending',${env.RLS_TEST_OWNER_ID},${env.RLS_TEST_OWNER_ID})`;
  });
  afterAll(async()=>{await fixtures`delete from public.organizations where id in (${organizationA},${organizationB})`;await Promise.all([runtime.end(),fixtures.end()]);});

  it("allows MEMBER to read only tenant expenses and categories",async()=>{
    expect(await asUser(env.RLS_TEST_MEMBER_ID,tx=>tx`select id from public.expenses`)).toEqual([{id:expenseA}]);
    expect(await asUser(env.RLS_TEST_MEMBER_ID,tx=>tx`select id from public.expense_categories`)).toEqual([{id:categoryA}]);
    expect(await asUser(env.RLS_TEST_OUTSIDER_ID,tx=>tx`select id from public.expenses where id=${expenseA}`)).toHaveLength(0);
  });
  it("denies MEMBER mutations",async()=>{
    expect(await asUser(env.RLS_TEST_MEMBER_ID,tx=>tx`update public.expenses set vendor='Forbidden' where id=${expenseA}`)).toHaveLength(0);
    expect(await asUser(env.RLS_TEST_MEMBER_ID,tx=>tx`delete from public.expenses where id=${expenseA}`)).toHaveLength(0);
  });
  it("allows managers, enforces tenant categories, and records immutable audit events",async()=>{
    await asUser(env.RLS_TEST_ADMIN_ID,tx=>tx`update public.expenses set status='paid',paid_date='2026-10-28' where id=${expenseA}`);
    await expect(asUser(env.RLS_TEST_ADMIN_ID,tx=>tx`update public.expenses set category_id=${categoryB} where id=${expenseA}`)).rejects.toThrow();
    const events=await asUser(env.RLS_TEST_OWNER_ID,tx=>tx<{event_type:string}[]>`select event_type::text from public.audit_events where organization_id=${organizationA} and metadata->>'expenseId'=${expenseA}`);
    expect(events.map(row=>row.event_type)).toEqual(expect.arrayContaining(["expense_created","expense_status_changed"]));
    await expect(asUser(env.RLS_TEST_ADMIN_ID,tx=>tx`delete from public.audit_events where organization_id=${organizationA}`)).rejects.toMatchObject({code:"42501"});
  });
});
