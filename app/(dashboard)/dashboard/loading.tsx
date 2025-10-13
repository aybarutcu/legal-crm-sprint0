export default function DashboardLoading() {
  return (
    <div className="space-y-8" data-testid="dashboard-loading">
      <section className="grid gap-6 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-2xl bg-slate-200/70"
          />
        ))}
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="h-56 animate-pulse rounded-2xl bg-slate-200/70"
          />
        ))}
      </section>
    </div>
  );
}
