import { z } from "zod";

export const invitationEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(320, "Email addresses must contain at most 320 characters.");

export const invitationRoleSchema = z.enum(["admin", "member"]);

export const createInvitationSchema = z.object({
  organizationId: z.uuid(),
  email: invitationEmailSchema,
  role: invitationRoleSchema,
});

export const invitationIdSchema = z.uuid();

export const invitationTokenSchema = z
  .string()
  .min(40)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/, "The invitation token is invalid.");
