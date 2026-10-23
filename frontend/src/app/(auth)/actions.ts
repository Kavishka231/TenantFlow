"use server";

import { redirect } from "next/navigation";

import { getSafeRedirectPath } from "@/lib/auth/redirect";
import {
  firstValidationError,
  loginSchema,
  registrationSchema,
} from "@/lib/auth/validation";
import { getPublicEnv } from "@/lib/env/public";
import { createClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/lib/auth/state";

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const result = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!result.success) {
    return { message: firstValidationError(result.error), status: "error" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: result.data.email,
    password: result.data.password,
  });

  if (error) {
    return { message: "Invalid email or password.", status: "error" };
  }

  redirect(getSafeRedirectPath(result.data.next));
}

export async function registerAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const result = registrationSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    next: formData.get("next") ?? undefined,
  });

  if (!result.success) {
    return { message: firstValidationError(result.error), status: "error" };
  }

  const env = getPublicEnv();
  const next = getSafeRedirectPath(result.data.next);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: result.data.email,
    password: result.data.password,
    options: {
      data: { full_name: result.data.fullName },
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return {
      message: "Account creation failed. Check your details and try again.",
      status: "error",
    };
  }

  if (data.session) {
    redirect(next);
  }

  return {
    message: "Check your email to confirm your account, then sign in.",
    status: "success",
  };
}
