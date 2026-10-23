import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

export const registrationSchema = z
  .object({
    fullName: z.string().trim().min(1, "Enter your name.").max(100),
    email: z.string().trim().toLowerCase().pipe(z.email()),
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(72, "Use at most 72 characters."),
    confirmPassword: z.string(),
    next: z.string().optional(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export function firstValidationError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the submitted details.";
}
