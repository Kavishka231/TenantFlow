"use server";

import { redirect } from "next/navigation";

import { getBillingForUser, registerStripeCustomerForUser } from "@/lib/billing/data";
import { createCheckoutSession, createPortalSession, createStripeCustomer } from "@/lib/billing/stripe-api";
import { checkoutInputSchema, portalInputSchema } from "@/lib/billing/validation";
import { getPublicEnv } from "@/lib/env/public";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";

export async function createCheckoutAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = checkoutInputSchema.safeParse({
    organizationId: formData.get("organizationId"),
    planKey: formData.get("planKey"),
  });
  if (!result.success) redirect("/dashboard");

  const organization = await requireOrganizationPermission(
    user.id,
    result.data.organizationId,
    "manage_billing",
  );
  const billing = await getBillingForUser(user.id, organization.id);
  let { customer } = billing;
  const { subscription } = billing;
  if (subscription && ["active", "trialing", "past_due"].includes(subscription.status)) {
    redirect(`/organizations/${organization.id}/billing?error=already-subscribed`);
  }

  if (!customer) {
    const created = await createStripeCustomer({
      organizationId: organization.id,
      organizationName: organization.name,
    });
    await registerStripeCustomerForUser(user.id, organization.id, created.id);
    customer = { stripeCustomerId: created.id };
  }

  const session = await createCheckoutSession({
    appUrl: getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, ""),
    customerId: customer.stripeCustomerId,
    organizationId: organization.id,
    planKey: result.data.planKey,
  });
  if (!session.url.startsWith("https://checkout.stripe.com/")) {
    throw new Error("Stripe returned an invalid Checkout URL.");
  }
  redirect(session.url);
}

export async function createPortalAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const result = portalInputSchema.safeParse({ organizationId: formData.get("organizationId") });
  if (!result.success) redirect("/dashboard");

  const organization = await requireOrganizationPermission(
    user.id,
    result.data.organizationId,
    "manage_billing",
  );
  const { customer } = await getBillingForUser(user.id, organization.id);
  if (!customer) redirect(`/organizations/${organization.id}/billing?error=no-customer`);

  const session = await createPortalSession({
    appUrl: getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, ""),
    customerId: customer.stripeCustomerId,
    organizationId: organization.id,
  });
  const destination = new URL(session.url);
  if (destination.protocol !== "https:" || destination.hostname !== "billing.stripe.com") {
    throw new Error("Stripe returned an invalid Customer Portal URL.");
  }
  redirect(session.url);
}
