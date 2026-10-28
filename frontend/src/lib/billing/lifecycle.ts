export const subscriptionStatusLabels = {
  incomplete: "Incomplete",
  incomplete_expired: "Expired",
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  unpaid: "Unpaid",
  paused: "Paused",
} as const;

export type SubscriptionStatus = keyof typeof subscriptionStatusLabels;

/** Stripe remains authoritative; these statuses only determine local access. */
export function hasPaidPlanAccess(status: SubscriptionStatus | null) {
  return status === "active" || status === "trialing" || status === "past_due";
}

export function subscriptionNotice(input: {
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  status: SubscriptionStatus;
}) {
  if (input.cancelAtPeriodEnd && input.currentPeriodEnd) {
    return `Cancels at the end of the current period on ${input.currentPeriodEnd.toLocaleDateString("en-US")}.`;
  }
  if (input.status === "past_due" || input.status === "unpaid") {
    return "Payment needs attention. Update the payment method in Stripe.";
  }
  return "Renewal and status changes are synchronized from Stripe.";
}
