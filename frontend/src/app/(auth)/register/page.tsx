import type { Metadata } from "next";

import { registerAction } from "@/app/(auth)/actions";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return <AuthForm action={registerAction} mode="register" />;
}
