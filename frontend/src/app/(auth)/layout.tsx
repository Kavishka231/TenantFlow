import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Building2, ShieldCheck } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-950 px-4 py-10 sm:px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.24),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.14),transparent_35%)]" aria-hidden="true" />
      <div className="relative flex w-full flex-col items-center gap-7">
        <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight text-slate-950">
          <span className="grid size-10 place-items-center rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/25">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <span className="text-lg text-white">TenantFlow</span>
        </Link>
        {children}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-300">
          <span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-400" aria-hidden="true" />Tenant-isolated by design</span>
          <Link href="/" className="inline-flex items-center gap-1 hover:text-white"><ArrowLeft className="size-4" aria-hidden="true" />Back home</Link>
        </div>
      </div>
    </main>
  );
}
