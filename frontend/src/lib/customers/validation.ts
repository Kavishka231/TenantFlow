import { z } from "zod";

function optionalTrimmedString(schema: z.ZodString) {
  return z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? null : value,
    schema.trim().nullable(),
  );
}

export const customerStatusSchema = z.enum(["lead", "active", "inactive"]);

export const customerFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter the customer's name.")
    .max(160, "Names must contain at most 160 characters."),
  email: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? null : value,
    z
      .string()
      .trim()
      .toLowerCase()
      .email("Enter a valid email address.")
      .max(320)
      .nullable(),
  ),
  phone: optionalTrimmedString(
    z
      .string()
      .min(3, "Phone numbers must contain at least 3 characters.")
      .max(32, "Phone numbers must contain at most 32 characters.")
      .regex(
        /^[+()\d\s.-]+$/,
        "Phone numbers may contain digits, spaces, and + ( ) . - only.",
      ),
  ),
  company: optionalTrimmedString(z.string().min(1).max(160)),
  address: optionalTrimmedString(z.string().max(1000)),
  status: customerStatusSchema,
  notes: optionalTrimmedString(z.string().max(5000)),
});

export const createCustomerSchema = customerFieldsSchema.extend({
  organizationId: z.uuid(),
});

export const customerIdentitySchema = z.object({
  customerId: z.uuid(),
  organizationId: z.uuid(),
});

export const updateCustomerSchema = customerFieldsSchema.extend({
  customerId: z.uuid(),
  organizationId: z.uuid(),
  version: z.coerce.number().int().positive(),
});

export const deleteCustomerSchema = customerIdentitySchema.extend({
  version: z.coerce.number().int().positive(),
});

export type CustomerFields = z.infer<typeof customerFieldsSchema>;
