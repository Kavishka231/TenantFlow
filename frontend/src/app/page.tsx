import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  LockKeyhole,
  ShieldCheck,
  Users,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const principles = [
  {
    icon: Building2,
    title: "Workspace ready",
    description: "A clean foundation for organization-scoped work.",
  },
  {
    icon: ShieldCheck,
    title: "Isolation first",
    description: "Authorization and database policies are designed together.",
  },
  {
    icon: Users,
    title: "Built for teams",
    description: "Membership and roles are first-class platform concepts.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 lg:px-8">
        <header className="flex h-20 items-center justify-between border-b border-white/10">
          <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight">
            <span className="grid size-9 place-items-center rounded-xl bg-indigo-500 shadow-lg shadow-indigo-500/25">
              <Building2 className="size-5" aria-hidden="true" />
            </span>
            <span className="text-lg">TenantFlow</span>
          </Link>
          <nav className="flex items-center gap-2" aria-label="Account navigation">
            <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }), "text-slate-200 hover:bg-white/10 hover:text-white")}>
              Log in
            </Link>
            <Link href="/register" className={cn(buttonVariants(), "bg-white text-slate-950 hover:bg-slate-200")}>
              Create account
            </Link>
          </nav>
        </header>

        <section className="grid flex-1 items-center gap-16 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:py-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1.5 text-sm text-indigo-200">
              <LockKeyhole className="size-4" aria-hidden="true" />
              Secure multi-tenant foundation
            </div>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              Run every workspace with clarity.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              TenantFlow gives growing teams a secure home for their operations, with tenant isolation designed into every layer.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className={cn(buttonVariants({ size: "lg" }), "bg-indigo-500 px-5 text-white hover:bg-indigo-400")}>
                Start securely <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "border-white/15 bg-white/5 px-5 text-white hover:bg-white/10 hover:text-white")}>
                Sign in
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-12 -z-10 bg-indigo-500/20 blur-3xl" />
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.07] p-3 shadow-2xl shadow-black/40 backdrop-blur">
              <div className="rounded-2xl bg-slate-50 p-5 text-slate-950 sm:p-7">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
                  <div>
                    <p className="text-sm font-medium text-indigo-600">Workspace overview</p>
                    <h2 className="mt-1 text-2xl font-semibold">Welcome to TenantFlow</h2>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">Protected</span>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  {principles.map(({ icon: Icon, title, description }) => (
                    <article key={title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <span className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <h3 className="mt-4 text-sm font-semibold">{title}</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
                    </article>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3 text-sm font-medium">
                    <CheckCircle2 className="size-5 text-emerald-500" aria-hidden="true" />
                    Foundation status
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full w-1/3 rounded-full bg-indigo-500" />
                  </div>
                  <p className="mt-3 text-xs text-slate-500">Authentication and tenant-safe data access are being established first.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
