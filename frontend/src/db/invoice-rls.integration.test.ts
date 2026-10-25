import { randomUUID } from "node:crypto";

import { config as loadEnv } from "dotenv";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

loadEnv({ path: ".env.test.local", quiet: true });
const envResult = z.object({
  DATABASE_URL: z.string().startsWith("postgresql://"),
  MIGRATION_DATABASE_URL: z.string().startsWith("postgresql://"),
  RLS_TEST_OWNER_ID: z.uuid(), RLS_TEST_ADMIN_ID: z.uuid(), RLS_TEST_MEMBER_ID: z.uuid(), RLS_TEST_OUTSIDER_ID: z.uuid(),
}).safeParse(process.env);
const describeLive = envResult.success ? describe : describe.skip;

describeLive("PostgreSQL invoice RLS and lifecycle", () => {
  if (!envResult.success) return;
  const env=envResult.data;const runtime=postgres(env.DATABASE_URL,{max:1,prepare:false});const fixture=postgres(env.MIGRATION_DATABASE_URL,{max:1,prepare:false});
  const organizationA=randomUUID(),organizationB=randomUUID(),customerA=randomUUID(),customerB=randomUUID(),invoiceA=randomUUID(),invoiceB=randomUUID(),paymentKey=randomUUID();
  type Tx=postgres.TransactionSql;
  const asUser=<T>(userId:string,operation:(tx:Tx)=>Promise<T>)=>runtime.begin(async tx=>{const claims=JSON.stringify({sub:userId,role:"authenticated"});await tx`select set_config('request.jwt.claim.sub',${userId},true),set_config('request.jwt.claims',${claims},true)`;return operation(tx);});

  beforeAll(async()=>{
    const [role]=await runtime<{authenticated:boolean;bypass:boolean;owner:boolean;superuser:boolean}[]>`select pg_has_role(current_user,'authenticated','member') authenticated,rolbypassrls bypass,rolsuper superuser,exists(select 1 from pg_class where oid='public.invoices'::regclass and pg_get_userbyid(relowner)=current_user) owner from pg_roles where rolname=current_user`;
    expect(role).toEqual({authenticated:true,bypass:false,owner:false,superuser:false});
    const ids=[env.RLS_TEST_OWNER_ID,env.RLS_TEST_ADMIN_ID,env.RLS_TEST_MEMBER_ID,env.RLS_TEST_OUTSIDER_ID];const[count]=await fixture<{count:number}[]>`select count(*)::int count from public.profiles where id=any(${ids}::uuid[])`;if(count.count!==4)throw new Error("Create the four RLS test identities through Supabase Auth first.");
    await fixture`insert into public.organizations(id,name,slug,created_by) values (${organizationA},'Invoice RLS A',${`invoice-a-${organizationA}`},${env.RLS_TEST_OWNER_ID}),(${organizationB},'Invoice RLS B',${`invoice-b-${organizationB}`},${env.RLS_TEST_OUTSIDER_ID})`;
    await fixture`insert into public.organization_members(organization_id,user_id,role) values (${organizationA},${env.RLS_TEST_OWNER_ID},'owner'),(${organizationA},${env.RLS_TEST_ADMIN_ID},'admin'),(${organizationA},${env.RLS_TEST_MEMBER_ID},'member'),(${organizationB},${env.RLS_TEST_OUTSIDER_ID},'owner')`;
    await fixture`insert into public.customers(id,organization_id,name,created_by,updated_by) values (${customerA},${organizationA},'Invoice Customer A',${env.RLS_TEST_OWNER_ID},${env.RLS_TEST_OWNER_ID}),(${customerB},${organizationB},'Invoice Customer B',${env.RLS_TEST_OUTSIDER_ID},${env.RLS_TEST_OUTSIDER_ID})`;
    await fixture`insert into public.invoices(id,organization_id,customer_id,invoice_number,number_sequence,currency,issue_date,due_date,subtotal_minor,total_minor,created_by,updated_by) values (${invoiceA},${organizationA},${customerA},'INV-TEST-A',900001,'USD',current_date,current_date+30,1000,1000,${env.RLS_TEST_OWNER_ID},${env.RLS_TEST_OWNER_ID}),(${invoiceB},${organizationB},${customerB},'INV-TEST-B',900001,'USD',current_date,current_date+30,1000,1000,${env.RLS_TEST_OUTSIDER_ID},${env.RLS_TEST_OUTSIDER_ID})`;
    await fixture`insert into public.invoice_items(organization_id,invoice_id,description,quantity,unit_price_minor,line_total_minor,position) values (${organizationA},${invoiceA},'Service',1,1000,1000,1),(${organizationB},${invoiceB},'Service',1,1000,1000,1)`;
  });
  afterAll(async()=>{await fixture`delete from public.organizations where id in (${organizationA},${organizationB})`;await Promise.all([runtime.end(),fixture.end()]);});

  it("limits member and outsider reads to their tenant",async()=>{const member=await asUser(env.RLS_TEST_MEMBER_ID,tx=>tx<{id:string}[]>`select id::text id from public.invoices where id in (${invoiceA},${invoiceB})`);const outsider=await asUser(env.RLS_TEST_OUTSIDER_ID,tx=>tx`select id from public.invoices where id=${invoiceA}`);expect(member.map(row=>row.id)).toEqual([invoiceA]);expect(outsider).toHaveLength(0);});
  it("denies member writes and cross-tenant manager writes",async()=>{const memberUpdate=await asUser(env.RLS_TEST_MEMBER_ID,tx=>tx`update public.invoices set notes='forbidden' where id=${invoiceA} returning id`);const crossTenant=await asUser(env.RLS_TEST_OWNER_ID,tx=>tx`update public.invoices set notes='forbidden' where id=${invoiceB} returning id`);expect(memberUpdate).toHaveLength(0);expect(crossTenant).toHaveLength(0);});
  it("serializes sending and idempotent payments while rejecting overpayment",async()=>{await asUser(env.RLS_TEST_OWNER_ID,tx=>tx`select public.send_invoice(${organizationA},${invoiceA})`);await asUser(env.RLS_TEST_ADMIN_ID,tx=>tx`select public.record_invoice_payment(${organizationA},${invoiceA},${paymentKey},400,current_date,'bank_transfer',null,null)`);await asUser(env.RLS_TEST_ADMIN_ID,tx=>tx`select public.record_invoice_payment(${organizationA},${invoiceA},${paymentKey},400,current_date,'bank_transfer',null,null)`);const[summary]=await asUser(env.RLS_TEST_OWNER_ID,tx=>tx<{paid:number;payments:number;status:string}[]>`select i.paid_minor::int paid,i.status::text status,(select count(*)::int from public.payment_records p where p.invoice_id=i.id) payments from public.invoices i where i.id=${invoiceA}`);expect(summary).toEqual({paid:400,payments:1,status:"partially_paid"});await expect(asUser(env.RLS_TEST_OWNER_ID,tx=>tx`select public.record_invoice_payment(${organizationA},${invoiceA},${randomUUID()},601,current_date,'cash',null,null)`)).rejects.toThrow(/outstanding balance/);});
  it("rejects lifecycle calls from members and exposes audit only to managers",async()=>{await expect(asUser(env.RLS_TEST_MEMBER_ID,tx=>tx`select public.cancel_invoice(${organizationA},${invoiceA})`)).rejects.toMatchObject({code:"42501"});const managerEvents=await asUser(env.RLS_TEST_OWNER_ID,tx=>tx<{type:string}[]>`select event_type::text type from public.audit_events where organization_id=${organizationA} and event_type::text like 'invoice_%' or organization_id=${organizationA} and event_type='payment_recorded'`);const memberEvents=await asUser(env.RLS_TEST_MEMBER_ID,tx=>tx`select id from public.audit_events where organization_id=${organizationA}`);expect(managerEvents.map(row=>row.type)).toEqual(expect.arrayContaining(["invoice_sent","payment_recorded"]));expect(memberEvents).toHaveLength(0);});
});
