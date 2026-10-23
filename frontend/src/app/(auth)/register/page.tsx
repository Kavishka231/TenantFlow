import type { Metadata } from "next";
import { Suspense } from "react";

import { registerAction } from "@/app/(auth)/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { getSafeRedirectPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Create account" };

async function RegisterForm({
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

export default function RegisterPage(props: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-96 w-full max-w-md animate-pulse rounded-2xl bg-white shadow-sm" />}>
      <RegisterForm {...props} />
    </Suspense>
  );
}
