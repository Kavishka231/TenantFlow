export default function TeamLoading() {
  return (
    <main className="min-h-screen animate-pulse bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-10 w-40 rounded-lg bg-slate-200" />
        <div className="h-24 rounded-2xl bg-white" />
        <div className="h-52 rounded-2xl bg-white" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-72 rounded-2xl bg-white" />
          <div className="h-72 rounded-2xl bg-white" />
        </div>
      </div>
    </main>
  );
}
