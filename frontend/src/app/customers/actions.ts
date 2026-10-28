"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { CustomerActionState } from "@/lib/customers/action-state";
import { PlanLimitError } from "@/lib/billing/entitlements";
import {
  createCustomerForUser,
  CustomerConflictError,
  deleteCustomerForUser,
  updateCustomerForUser,
} from "@/lib/customers/mutations";
import {
  createCustomerSchema,
  deleteCustomerSchema,
  updateCustomerSchema,
} from "@/lib/customers/validation";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

function customerFormValues(formData: FormData) {
  return {
    address: formData.get("address"),
    company: formData.get("company"),
    email: formData.get("email"),
    name: formData.get("name"),
    notes: formData.get("notes"),
    phone: formData.get("phone"),
    status: formData.get("status"),
  };
}

export async function createCustomerAction(
  _previousState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const result = createCustomerSchema.safeParse({
    ...customerFormValues(formData),
    organizationId: formData.get("organizationId"),
  });

  if (!result.success) {
    return {
      message: result.error.issues[0]?.message ?? "Check the customer details.",
      status: "error",
    };
  }

  const user = await requireUser();

  let customerId: string;
  try {
    await requireOrganizationPermission(
      user.id,
      result.data.organizationId,
      "manage_customers",
    );
    const customer = await createCustomerForUser(user.id, result.data);
    customerId = customer.id;
    revalidatePath(`/organizations/${result.data.organizationId}/customers`);
  } catch (error) {
    if (error instanceof PlanLimitError) {
      return { message: `${error.message} Ask the workspace owner to upgrade billing.`, status: "error" };
    }
    if (error instanceof CustomerConflictError) {
      return { message: error.message, status: "error" };
    }
    return {
      message: "You cannot create a customer in this workspace.",
      status: "error",
    };
  }

  redirect(
    `/organizations/${result.data.organizationId}/customers/${customerId}?created=1`,
  );
}

export async function updateCustomerAction(
  _previousState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const result = updateCustomerSchema.safeParse({
    ...customerFormValues(formData),
    customerId: formData.get("customerId"),
    organizationId: formData.get("organizationId"),
    version: formData.get("version"),
  });

  if (!result.success) {
    return {
      message: result.error.issues[0]?.message ?? "Check the customer details.",
      status: "error",
    };
  }

  const user = await requireUser();

  try {
    await requireOrganizationPermission(
      user.id,
      result.data.organizationId,
      "manage_customers",
    );
    await updateCustomerForUser(user.id, result.data);
    revalidatePath(`/organizations/${result.data.organizationId}/customers`);
    revalidatePath(
      `/organizations/${result.data.organizationId}/customers/${result.data.customerId}`,
    );
  } catch (error) {
    return {
      message:
        error instanceof CustomerConflictError
          ? error.message
          : "You cannot update this customer.",
      status: "error",
    };
  }

  redirect(
    `/organizations/${result.data.organizationId}/customers/${result.data.customerId}?updated=1`,
  );
}

export async function deleteCustomerAction(formData: FormData) {
  const result = deleteCustomerSchema.safeParse({
    customerId: formData.get("customerId"),
    organizationId: formData.get("organizationId"),
    version: formData.get("version"),
  });

  if (!result.success) {
    redirect("/dashboard");
  }

  const user = await requireUser();
  await requireOrganizationPermission(
    user.id,
    result.data.organizationId,
    "manage_customers",
  );
  let status = "deleted";
  try {
    await deleteCustomerForUser(user.id, result.data);
    revalidatePath(`/organizations/${result.data.organizationId}/customers`);
  } catch (error) {
    if (error instanceof CustomerConflictError) {
      status = "conflict";
    } else {
      throw error;
    }
  }
  redirect(
    `/organizations/${result.data.organizationId}/customers?customerStatus=${status}`,
  );
}
