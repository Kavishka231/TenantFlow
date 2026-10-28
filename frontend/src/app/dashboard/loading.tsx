export default function DashboardLoading() {
  return <main className="min-h-screen animate-pulse bg-slate-50"><div className="h-16 border-b bg-white" /><div className="mx-auto max-w-7xl space-y-6 px-6 py-10"><div className="h-20 rounded-2xl bg-white" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-36 rounded-xl bg-white" />)}</div><div className="grid gap-5 lg:grid-cols-2"><div className="h-80 rounded-xl bg-white" /><div className="h-80 rounded-xl bg-white" /></div></div></main>;
}
