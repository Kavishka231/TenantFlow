import type { Metadata } from "next";
import { Suspense } from "react";

import { loginAction } from "@/app/(auth)/actions";
import { AuthForm } from "@/components/auth/auth-form";
import { getSafeRedirectPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Log in" };

async function LoginForm({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;

  return (
    <AuthForm
      action={loginAction}
      mode="login"
      next={getSafeRedirectPath(next)}
      notice={reason === "session-required" ? "Your session may have expired. Sign in to continue securely." : undefined}
    />
  );
}

export default function LoginPage(props: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-96 w-full max-w-md animate-pulse rounded-2xl bg-white shadow-sm" />}>
      <LoginForm {...props} />
    </Suspense>
  );
}
