import Link from "next/link";
import { redirect } from "next/navigation";
import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { ApprovalStatus } from "@prisma/client";

export default async function PortalDashboardPage() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/portal/login");
  }

  if (session.user.role !== "CLIENT") {
    redirect("/dashboard");
  }

  const userId = session.user.id;
  const now = new Date();
  const upcomingWindow = addDays(now, 14);

  const [matters, approvals, events] = await Promise.all([
    prisma.matter.findMany({
      where: { client: { userId } },
      orderBy: { openedAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        nextHearingAt: true,
        openedAt: true,
      },
    }),
    prisma.approval.findMany({
      where: { clientUserId: userId, status: ApprovalStatus.PENDING },
      orderBy: { requestedAt: "desc" },
      take: 5,
      select: {
        id: true,
        requestedAt: true,
        matter: { select: { id: true, title: true } },
        document: { select: { id: true, filename: true } },
      },
    }),
    prisma.event.findMany({
      where: {
        matter: { client: { userId } },
        startAt: { gte: now, lte: upcomingWindow },
      },
      orderBy: { startAt: "asc" },
      take: 5,
      select: {
        id: true,
        title: true,
        startAt: true,
        location: true,
        matter: { select: { id: true, title: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Merhaba {session.user.name ?? "müvekkil"},</h1>
            <p className="text-sm text-slate-500">
              Davalarınız, yaklaşan randevular ve onay bekleyen belgeler burada listelenir.
            </p>
          </div>
          <Link
            href="/portal/messages"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Mesajlar
          </Link>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Davalarım</h2>
            <Link href="/portal/matters" className="text-xs font-semibold uppercase tracking-widest text-accent">
              Tümü
            </Link>
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            {matters.length === 0 ? (
              <p className="text-slate-400">Henüz sizinle paylaşılan bir dava bulunmuyor.</p>
            ) : (
              matters.map((matter) => (
                <Link
                  key={matter.id}
                  href={`/portal/matters/${matter.id}`}
                  className="block rounded-xl border border-slate-200 p-3 hover:border-accent"
                >
                  <div className="font-medium text-slate-900">{matter.title}</div>
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    {matter.status}
                    {matter.nextHearingAt
                      ? ` · Son duruşma: ${new Date(matter.nextHearingAt).toLocaleString("tr-TR")}`
                      : ""}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Onay Bekleyenler</h2>
            <Link href="/portal/approvals" className="text-xs font-semibold uppercase tracking-widest text-accent">
              Tümü
            </Link>
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            {approvals.length === 0 ? (
              <p className="text-slate-400">Bekleyen onayınız bulunmuyor.</p>
            ) : (
              approvals.map((approval) => (
                <Link
                  key={approval.id}
                  href={`/portal/approvals/${approval.id}`}
                  className="block rounded-xl border border-slate-200 p-3 hover:border-accent"
                >
                  <div className="font-medium text-slate-900">
                    {approval.document?.filename ?? "Belge"}
                  </div>
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    {approval.matter?.title ?? "Dava"}
                    {" · "}
                    {new Date(approval.requestedAt).toLocaleDateString("tr-TR")}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Yaklaşan Randevular</h2>
            <Link href="/portal/events" className="text-xs font-semibold uppercase tracking-widest text-accent">
              Takvim
            </Link>
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            {events.length === 0 ? (
              <p className="text-slate-400">Önümüzdeki 14 gün içinde etkinliğiniz yok.</p>
            ) : (
              events.map((event) => (
                <div key={event.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="font-medium text-slate-900">{event.title}</div>
                  <div className="text-xs uppercase tracking-widest text-slate-500">
                    {event.matter?.title ?? "Genel"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(event.startAt).toLocaleString("tr-TR")}
                    {event.location ? ` · ${event.location}` : ""}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
