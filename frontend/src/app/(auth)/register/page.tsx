import type { Metadata } from "next";

import { registerAction } from "@/app/(auth)/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { getSafeRedirectPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <AuthForm
      action={registerAction}
      mode="register"
      next={getSafeRedirectPath(next)}
    />
  );
}
