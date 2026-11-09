"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialAuthState, type AuthActionState } from "@/lib/auth/state";

type AuthAction = (
  state: AuthActionState,
  formData: FormData,
) => Promise<AuthActionState>;

type AuthFormProps = {
  action: AuthAction;
  mode: "login" | "register";
  next?: string;
  notice?: string;
};

export function AuthForm({ action, mode, next, notice }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, initialAuthState);
  const isLogin = mode === "login";

  return (
    <Card className="w-full max-w-md border-white/10 bg-white shadow-2xl shadow-black/30">
      <CardHeader>
        <CardTitle className="text-2xl">
          {isLogin ? "Welcome back" : "Create your account"}
        </CardTitle>
        <CardDescription>
          {isLogin
            ? "Sign in to continue to your workspace."
            : "Start with a secure TenantFlow identity."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {notice ? (
          <p className="mb-4 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm leading-6 text-sky-900" role="status">
            <Info className="mt-1 size-4 shrink-0" aria-hidden="true" />
            {notice}
          </p>
        ) : null}
        <form action={formAction} className="space-y-4">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          {!isLogin ? (
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" name="fullName" autoComplete="name" maxLength={100} required />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              minLength={isLogin ? undefined : 8}
              maxLength={72}
              required
            />
          </div>
          {!isLogin ? (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
              />
            </div>
          ) : null}
          {state.message ? (
            <p
              className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-emerald-700"}
              role={state.status === "error" ? "alert" : "status"}
            >
              {state.message}
            </p>
          ) : null}
          <Button className="w-full" type="submit" disabled={pending} aria-busy={pending}>
            {pending ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        {isLogin ? "New to TenantFlow?" : "Already have an account?"}&nbsp;
        <Link className="font-medium text-foreground underline-offset-4 hover:underline" href={`${isLogin ? "/register" : "/login"}${next ? `?next=${encodeURIComponent(next)}` : ""}`}>
          {isLogin ? "Create an account" : "Sign in"}
        </Link>
      </CardFooter>
    </Card>
  );
}
