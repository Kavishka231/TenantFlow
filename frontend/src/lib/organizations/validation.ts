import { z } from "zod";

export const organizationNameSchema = z
  .string()
  .trim()
  .min(2, "Organization names must contain at least 2 characters.")
  .max(120, "Organization names must contain at most 120 characters.");

export const organizationSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Workspace URLs must contain at least 2 characters.")
  .max(63, "Workspace URLs must contain at most 63 characters.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and single hyphens only.",
  );

export const createOrganizationSchema = z.object({
  name: organizationNameSchema,
  slug: organizationSlugSchema,
});

export const updateOrganizationSchema = z.object({
  organizationId: z.uuid(),
  name: organizationNameSchema,
});

export function slugifyOrganizationName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "");
}
