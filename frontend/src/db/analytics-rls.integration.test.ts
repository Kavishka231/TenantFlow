import { randomUUID } from "node:crypto";

import { config as loadEnv } from "dotenv";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

loadEnv({ path: ".env.test.local", quiet: true });
const result = z.object({
  DATABASE_URL: z.string().startsWith("postgresql://"),
  MIGRATION_DATABASE_URL: z.string().startsWith("postgresql://"),
  RLS_TEST_MEMBER_ID: z.uuid(), RLS_TEST_OUTSIDER_ID: z.uuid(),
}).safeParse(process.env);
const describeWithDatabase = result.success ? describe : describe.skip;

describeWithDatabase("PostgreSQL analytics isolation", () => {
  if (!result.success) return;
  const env = result.data;
  const runtime = postgres(env.DATABASE_URL, { max: 1, prepare: false });
  const fixtures = postgres(env.MIGRATION_DATABASE_URL, { max: 1, prepare: false });
  const organizationA = randomUUID(); const organizationB = randomUUID();
  const customerA = randomUUID(); const customerB = randomUUID();
  const invoiceA = randomUUID(); const invoiceB = randomUUID();
  type Tx = postgres.TransactionSql;
  const asUser = <T>(userId: string, work: (tx: Tx) => Promise<T>) => runtime.begin(async tx => {
    const claims = JSON.stringify({ sub: userId, role: "authenticated" });
    await tx`select set_config('request.jwt.claim.sub', ${userId}, true), set_config('request.jwt.claims', ${claims}, true)`;
    return work(tx);
  });

  beforeAll(async () => {
    const [role] = await runtime<{ authenticated: boolean; bypass: boolean; owner: boolean; superuser: boolean }[]>`
      select pg_has_role(current_user,'authenticated','member') authenticated, rolbypassrls bypass,
        rolsuper superuser, exists(select 1 from pg_class where oid='public.invoices'::regclass and pg_get_userbyid(relowner)=current_user) owner
      from pg_roles where rolname=current_user`;
    expect(role).toEqual({ authenticated: true, bypass: false, owner: false, superuser: false });
    await fixtures`insert into public.organizations(id,name,slug,created_by) values
      (${organizationA},'Analytics A',${`analytics-a-${organizationA}`},${env.RLS_TEST_MEMBER_ID}),
      (${organizationB},'Analytics B',${`analytics-b-${organizationB}`},${env.RLS_TEST_OUTSIDER_ID})`;
    await fixtures`insert into public.organization_members(organization_id,user_id,role) values
      (${organizationA},${env.RLS_TEST_MEMBER_ID},'member'),(${organizationB},${env.RLS_TEST_OUTSIDER_ID},'owner')`;
    await fixtures`insert into public.customers(id,organization_id,name,status,created_by,updated_by) values
      (${customerA},${organizationA},'Visible analytics customer','active',${env.RLS_TEST_MEMBER_ID},${env.RLS_TEST_MEMBER_ID}),
      (${customerB},${organizationB},'Hidden analytics customer','active',${env.RLS_TEST_OUTSIDER_ID},${env.RLS_TEST_OUTSIDER_ID})`;
    await fixtures`insert into public.invoices(id,organization_id,customer_id,invoice_number,number_sequence,status,currency,issue_date,due_date,total_minor,paid_minor,created_by,updated_by) values
      (${invoiceA},${organizationA},${customerA},'AN-A-1',1,'paid','USD','2026-10-01','2026-10-15',10000,6000,${env.RLS_TEST_MEMBER_ID},${env.RLS_TEST_MEMBER_ID}),
      (${invoiceB},${organizationB},${customerB},'AN-B-1',1,'paid','EUR','2026-10-01','2026-10-15',900000,900000,${env.RLS_TEST_OUTSIDER_ID},${env.RLS_TEST_OUTSIDER_ID})`;
    await fixtures`insert into public.payment_records(organization_id,invoice_id,idempotency_key,amount_minor,payment_date,method,recorded_by) values
      (${organizationA},${invoiceA},${randomUUID()},6000,'2026-10-10','bank_transfer',${env.RLS_TEST_MEMBER_ID}),
      (${organizationB},${invoiceB},${randomUUID()},900000,'2026-10-10','bank_transfer',${env.RLS_TEST_OUTSIDER_ID})`;
  });

  afterAll(async () => {
    await fixtures`delete from public.organizations where id in (${organizationA},${organizationB})`;
    await Promise.all([runtime.end(), fixtures.end()]);
  });

  it("allows MEMBER to aggregate only their tenant's business records", async () => {
    const result = await asUser(env.RLS_TEST_MEMBER_ID, async tx => ({
      customers: await tx`select count(*)::int count from public.customers`,
      invoices: await tx`select currency, sum(total_minor)::int total from public.invoices group by currency`,
      payments: await tx`select sum(amount_minor)::int total from public.payment_records`,
    }));
    expect(result.customers).toEqual([{ count: 1 }]);
    expect(result.invoices).toEqual([{ currency: "USD", total: 10000 }]);
    expect(result.payments).toEqual([{ total: 6000 }]);
  });

  it("returns no rows for a client-provided unauthorized organization ID", async () => {
    const rows = await asUser(env.RLS_TEST_MEMBER_ID, tx => tx`
      select id from public.invoices where organization_id=${organizationB}`);
    expect(rows).toHaveLength(0);
  });
});
