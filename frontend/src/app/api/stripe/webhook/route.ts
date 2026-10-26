import { NextResponse } from "next/server";

import { getStripeEnv } from "@/lib/billing/env";
import { processStripeWebhookPayload } from "@/lib/billing/webhook-processing";
import { verifyStripeSignature } from "@/lib/billing/webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature || !verifyStripeSignature(payload, signature, getStripeEnv().STRIPE_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }
  try {
    const processed = await processStripeWebhookPayload(payload);
    return NextResponse.json({ received: true, processed });
  } catch (error) {
    console.error("Stripe webhook processing failed", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 400 });
  }
}
