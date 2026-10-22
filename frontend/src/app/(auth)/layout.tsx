import Link from "next/link";
import type { ReactNode } from "react";
import { Building2 } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6 py-12">
      <div className="flex w-full flex-col items-center gap-8">
        <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight text-slate-950">
          <span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <span className="text-lg">TenantFlow</span>
        </Link>
        {children}
      </div>
    </main>
  );
}
