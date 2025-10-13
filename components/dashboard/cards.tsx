import Link from "next/link";

export type DashboardOverview = {
  events: Array<{
    id: string;
    title: string;
    startAt: string;
    location: string | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    dueAt: string | null;
    priority: "LOW" | "MEDIUM" | "HIGH";
  }>;
  documents: Array<{
    id: string;
    filename: string;
    createdAt: string;
    matter: { id: string; title: string } | null;
  }>;
  openMatters: number;
  mattersOpenCount: number;
  tasksDueSoon: number;
  tasksOverdue: number;
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-slate-400">{message}</p>;
}

export function DashboardCards({ overview }: { overview: DashboardOverview }) {
  const summaryCards = [
    {
      title: "Açık Davalar (OPEN)",
      value: overview.openMatters,
      description: "Durumu OPEN olan davalar.",
      href: "/matters",
    },
    {
      title: "Yaklaşan Etkinlikler",
      value: overview.events.length,
      description: "Önümüzdeki 7 gün içindeki etkinlikler.",
      href: "/events",
    },
    {
      title: "Görevler (≤7 gün)",
      value: overview.tasksDueSoon,
      description: "Önümüzdeki 7 gün içinde size atanan görevler.",
      href: "/tasks",
    },
    {
      title: "Geciken Görevler",
      value: overview.tasksOverdue,
      description: "Süresi geçen açık görevler.",
      href: "/tasks?tab=overdue",
    },
    {
      title: "Son Dokümanlar",
      value: overview.documents.length,
      description: "Son yüklediğiniz dokümanlar.",
      href: "/documents",
    },
  ];

  return (
    <div className="space-y-8" data-testid="dashboard-overview">
      <section className="grid gap-6 md:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
          >
            <div className="text-sm font-medium text-slate-500">{card.title}</div>
            <div className="mt-3 text-3xl font-semibold text-slate-900">
              {card.value}
            </div>
            <p className="mt-2 text-sm text-slate-500">{card.description}</p>
            <Link
              href={card.href}
              className="mt-4 inline-flex text-xs font-semibold uppercase tracking-widest text-accent"
            >
              İncele
            </Link>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-slate-900">
            Yaklaşan Etkinlikler (7 gün)
          </h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            {overview.events.length ? (
              overview.events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-xl bg-slate-50 p-3"
                  data-testid="dashboard-event"
                >
                  <div className="font-medium text-slate-900">{event.title}</div>
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    {dateFormatter.format(new Date(event.startAt))}
                  </div>
                  {event.location ? (
                    <div className="text-xs text-slate-400">{event.location}</div>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyState message="Yaklaşan etkinlik yok." />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Açık Görevler</h2>
            <Link
              href="/tasks"
              className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold uppercase tracking-widest text-white hover:bg-accent/90"
            >
              New Task
            </Link>
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            {overview.tasks.length ? (
              overview.tasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-xl bg-slate-50 p-3"
                  data-testid="dashboard-task"
                >
                  <div className="font-medium text-slate-900">{task.title}</div>
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    {`${task.priority} · ${
                      task.dueAt
                        ? dateFormatter.format(new Date(task.dueAt))
                        : "Son tarih belirtilmedi"
                    }`}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState message="Açık görev yok." />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-slate-900">
            Son Yüklenen Dokümanlar
          </h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            {overview.documents.length ? (
              overview.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-xl bg-slate-50 p-3"
                  data-testid="dashboard-document"
                >
                  <div className="font-medium text-slate-900">{doc.filename}</div>
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    {dateFormatter.format(new Date(doc.createdAt))}
                  </div>
                  {doc.matter ? (
                    <div className="text-xs text-slate-400">
                      Matter: {doc.matter.title}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyState message="Yeni doküman yüklenmedi." />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
