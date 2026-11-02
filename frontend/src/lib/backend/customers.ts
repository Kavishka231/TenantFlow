import "server-only";

import { z } from "zod";

import { PlanLimitError } from "@/lib/billing/entitlements";
import { BackendApiError, backendRequest } from "@/lib/backend/client";
import { getCustomerForUser } from "@/lib/customers/get";
import { listCustomersForUser } from "@/lib/customers/list";
import {
  createCustomerForUser,
  CustomerConflictError,
  deleteCustomerForUser,
  updateCustomerForUser,
} from "@/lib/customers/mutations";
import type { CustomerListQuery } from "@/lib/customers/query";
import type {
  createCustomerSchema,
  deleteCustomerSchema,
  updateCustomerSchema,
} from "@/lib/customers/validation";

type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
type DeleteCustomerInput = z.infer<typeof deleteCustomerSchema>;

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
  .transform(({ organization_id, created_at, updated_at, ...customer }) => ({
    ...customer,
    organizationId: organization_id,
    createdAt: created_at,
    updatedAt: updated_at,
  }));

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

function customerBody(input: CreateCustomerInput | UpdateCustomerInput) {
  return {
    address: input.address,
    company: input.company,
    email: input.email,
    name: input.name,
    notes: input.notes,
    phone: input.phone,
    status: input.status,
  };
}

export async function createCustomerThroughBackend(
  userId: string,
  accessToken: string | undefined,
  input: CreateCustomerInput,
) {
  try {
    const result = await backendRequest(
      `/api/v1/organizations/${input.organizationId}/customers`,
      accessToken,
      { method: "POST", body: JSON.stringify(customerBody(input)) },
    );
    if (!result.enabled) {
      return createCustomerForUser(userId, input);
    }
    return customerSchema.parse(result.data);
  } catch (error) {
    if (
      error instanceof BackendApiError &&
      error.code === "customer_plan_limit"
    ) {
      throw new PlanLimitError("customers");
    }
    throw error;
  }
}

export async function updateCustomerThroughBackend(
  userId: string,
  accessToken: string | undefined,
  input: UpdateCustomerInput,
) {
  try {
    const result = await backendRequest(
      `/api/v1/organizations/${input.organizationId}/customers/${input.customerId}`,
      accessToken,
      {
        method: "PATCH",
        body: JSON.stringify({
          ...customerBody(input),
          version: input.version,
        }),
      },
    );
    if (!result.enabled) {
      return updateCustomerForUser(userId, input);
    }
    return customerSchema.parse(result.data);
  } catch (error) {
    if (
      error instanceof BackendApiError &&
      error.code === "customer_version_conflict"
    ) {
      throw new CustomerConflictError();
    }
    throw error;
  }
}

export async function deleteCustomerThroughBackend(
  userId: string,
  accessToken: string | undefined,
  input: DeleteCustomerInput,
) {
  try {
    const result = await backendRequest(
      `/api/v1/organizations/${input.organizationId}/customers/${input.customerId}`,
      accessToken,
      { method: "DELETE", body: JSON.stringify({ version: input.version }) },
    );
    if (!result.enabled) {
      return deleteCustomerForUser(userId, input);
    }
    return { id: input.customerId };
  } catch (error) {
    if (
      error instanceof BackendApiError &&
      error.code === "customer_version_conflict"
    ) {
      throw new CustomerConflictError();
    }
    throw error;
  }
}
