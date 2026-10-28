import "server-only";

import { and, eq } from "drizzle-orm";
import type { z } from "zod";

import { withUserContext } from "@/db/client";
import { customers } from "@/db/schema";
import { assertResourceCapacity } from "@/lib/billing/entitlements";
import type {
  createCustomerSchema,
  deleteCustomerSchema,
  updateCustomerSchema,
} from "@/lib/customers/validation";

type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
type DeleteCustomerInput = z.infer<typeof deleteCustomerSchema>;

export class CustomerConflictError extends Error {
  constructor() {
    super("This customer changed since the page was loaded. Refresh and try again.");
    this.name = "CustomerConflictError";
  }
}

export function createCustomerForUser(
  userId: string,
  input: CreateCustomerInput,
) {
  return withUserContext(userId, async (transaction) => {
    await assertResourceCapacity(transaction, input.organizationId, "customers");
    const [customer] = await transaction
      .insert(customers)
      .values({
        address: input.address,
        company: input.company,
        createdBy: userId,
        email: input.email,
        name: input.name,
        notes: input.notes,
        organizationId: input.organizationId,
        phone: input.phone,
        status: input.status,
        updatedBy: userId,
      })
      .returning({ id: customers.id });

    if (!customer) {
      throw new Error("The customer could not be created.");
    }

    return customer;
  });
}

export function updateCustomerForUser(
  userId: string,
  input: UpdateCustomerInput,
) {
  return withUserContext(userId, async (transaction) => {
    const [customer] = await transaction
      .update(customers)
      .set({
        address: input.address,
        company: input.company,
        email: input.email,
        name: input.name,
        notes: input.notes,
        phone: input.phone,
        status: input.status,
        updatedBy: userId,
      })
      .where(
        and(
          eq(customers.id, input.customerId),
          eq(customers.organizationId, input.organizationId),
          eq(customers.version, input.version),
        ),
      )
      .returning({ id: customers.id });

    if (!customer) {
      throw new CustomerConflictError();
    }

    return customer;
  });
}

export function deleteCustomerForUser(
  userId: string,
  input: DeleteCustomerInput,
) {
  return withUserContext(userId, async (transaction) => {
    const [customer] = await transaction
      .delete(customers)
      .where(
        and(
          eq(customers.id, input.customerId),
          eq(customers.organizationId, input.organizationId),
          eq(customers.version, input.version),
        ),
      )
      .returning({ id: customers.id });

    if (!customer) {
      throw new CustomerConflictError();
    }

    return customer;
  });
}
