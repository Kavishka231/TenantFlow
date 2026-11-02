import "server-only";

import { z } from "zod";

import { backendRequest } from "@/lib/backend/client";
import { getCustomerForUser } from "@/lib/customers/get";
import { listCustomersForUser } from "@/lib/customers/list";
import type { CustomerListQuery } from "@/lib/customers/query";

const customerStatusSchema = z.enum(["lead", "active", "inactive"]);
const customerListItemSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    company: z.string().nullable(),
    status: customerStatusSchema,
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
  })
  .transform(({ created_at, updated_at, ...customer }) => ({
    ...customer,
    createdAt: created_at,
    updatedAt: updated_at,
  }));

const customerSchema = z
  .object({
    id: z.uuid(),
    organization_id: z.uuid(),
    name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    company: z.string().nullable(),
    address: z.string().nullable(),
    status: customerStatusSchema,
    notes: z.string().nullable(),
    version: z.number().int().positive(),
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
  })
  .transform(
    ({ organization_id, created_at, updated_at, ...customer }) => ({
      ...customer,
      organizationId: organization_id,
      createdAt: created_at,
      updatedAt: updated_at,
    }),
  );

const customerListSchema = z
  .object({
    customers: z.array(customerListItemSchema),
    page: z.number().int().positive(),
    page_count: z.number().int().positive(),
    page_size: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  })
  .transform(({ page_count, page_size, ...result }) => ({
    ...result,
    pageCount: page_count,
    pageSize: page_size,
  }));

export async function listCustomersThroughBackend(
  userId: string,
  accessToken: string | undefined,
  organizationId: string,
  query: CustomerListQuery,
) {
  const search = new URLSearchParams({
    page: String(query.page),
    page_size: String(query.pageSize),
    q: query.q,
    sort: query.sort,
  });
  if (query.status !== "all") {
    search.set("status", query.status);
  }
  const result = await backendRequest(
    `/api/v1/organizations/${organizationId}/customers?${search}`,
    accessToken,
  );
  if (!result.enabled) {
    return listCustomersForUser(userId, organizationId, query);
  }
  return customerListSchema.parse(result.data);
}

export async function getCustomerThroughBackend(
  userId: string,
  accessToken: string | undefined,
  organizationId: string,
  customerId: string,
) {
  const result = await backendRequest(
    `/api/v1/organizations/${organizationId}/customers/${customerId}`,
    accessToken,
  );
  if (!result.enabled) {
    return getCustomerForUser(userId, organizationId, customerId);
  }
  return customerSchema.parse(result.data);
}
