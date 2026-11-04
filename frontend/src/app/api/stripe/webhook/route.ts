import { NextResponse } from "next/server";

import { getStripeEnv } from "@/lib/billing/env";
import { processStripeWebhookPayload } from "@/lib/billing/webhook-processing";
import { isSupportedStripeSubscriptionEvent, verifyStripeSignature } from "@/lib/billing/webhook";
import { getServerEnv } from "@/lib/env/server";

export async function POST(request: Request) {
  const payloadBytes = await request.arrayBuffer();
  const payload = new TextDecoder().decode(payloadBytes);
  const signature = request.headers.get("stripe-signature");
  const { FASTAPI_INTERNAL_URL, STRIPE_WEBHOOK_PROCESSOR } = getServerEnv();
  if (STRIPE_WEBHOOK_PROCESSOR === "disabled") {
    return NextResponse.json({ error: "Webhook processing is disabled." }, { status: 503 });
  }
  if (STRIPE_WEBHOOK_PROCESSOR === "python") {
    if (!FASTAPI_INTERNAL_URL || !signature) return NextResponse.json({ error: "Python webhook processing is unavailable." }, { status: 503 });
    const response = await fetch(new URL("/api/v1/stripe/webhook", FASTAPI_INTERNAL_URL), {
      method: "POST", body: payloadBytes, headers: { "Content-Type": "application/json", "stripe-signature": signature },
      cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
    return new NextResponse(await response.arrayBuffer(), { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" } });
  }
  if (!signature || !verifyStripeSignature(payload, signature, getStripeEnv().STRIPE_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }
  try {
    const envelope = JSON.parse(payload) as { type?: unknown };
    if (!isSupportedStripeSubscriptionEvent(envelope.type)) {
      return NextResponse.json({ received: true, processed: false });
    }
    const processed = await processStripeWebhookPayload(payload);
    return NextResponse.json({ received: true, processed });
  } catch (error) {
    console.error("Stripe webhook processing failed", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 400 });
  }
}
