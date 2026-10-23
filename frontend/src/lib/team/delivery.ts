import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { getPublicEnv } from "@/lib/env/public";

type InvitationDelivery = {
  invitationId: string;
  email: string;
  organizationName: string;
  role: "admin" | "member";
  token: string;
};

export type InvitationDeliveryResult =
  | { channel: "webhook" | "development-outbox"; delivered: true }
  | {
      channel: "unconfigured" | "delivery-error";
      delivered: false;
    };

const webhookEnvSchema = z
  .object({
    INVITATION_DELIVERY_WEBHOOK_URL: z.url().optional(),
    INVITATION_DELIVERY_WEBHOOK_SECRET: z.string().min(16).optional(),
  })
  .refine(
    (value) =>
      Boolean(value.INVITATION_DELIVERY_WEBHOOK_URL) ===
      Boolean(value.INVITATION_DELIVERY_WEBHOOK_SECRET),
    "Invitation webhook URL and secret must be configured together.",
  );

export async function deliverInvitation(
  invitation: InvitationDelivery,
): Promise<InvitationDeliveryResult> {
  const acceptUrl = new URL("/invitations/accept", getPublicEnv().NEXT_PUBLIC_APP_URL);
  acceptUrl.searchParams.set("token", invitation.token);

  const webhook = webhookEnvSchema.parse(process.env);

  if (
    webhook.INVITATION_DELIVERY_WEBHOOK_URL &&
    webhook.INVITATION_DELIVERY_WEBHOOK_SECRET
  ) {
    const response = await fetch(webhook.INVITATION_DELIVERY_WEBHOOK_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${webhook.INVITATION_DELIVERY_WEBHOOK_SECRET}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        acceptUrl: acceptUrl.toString(),
        email: invitation.email,
        organizationName: invitation.organizationName,
        role: invitation.role,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Invitation delivery failed with status ${response.status}.`);
    }

    return { channel: "webhook", delivered: true };
  }

  if (
    process.env.NODE_ENV !== "production" &&
    process.env.INVITATION_DEV_OUTBOX === "true"
  ) {
    const outbox = path.join(process.cwd(), ".tenantflow-dev", "invitations");
    await mkdir(outbox, { recursive: true });
    await writeFile(
      path.join(outbox, `${invitation.invitationId}.json`),
      JSON.stringify(
        {
          acceptUrl: acceptUrl.toString(),
          email: invitation.email,
          organizationName: invitation.organizationName,
          role: invitation.role,
        },
        null,
        2,
      ),
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    );

    return { channel: "development-outbox", delivered: true };
  }

  return { channel: "unconfigured", delivered: false };
}
