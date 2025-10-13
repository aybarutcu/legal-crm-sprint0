import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EventsPageClient } from "@/components/events/EventsPageClient";
import type {
  CalendarOption,
  MatterOption,
  EventsResponse,
} from "@/components/events/types";
import {
  buildEventAccessFilter,
  eventDefaultInclude,
  serializeEvent,
} from "@/lib/events/service";
import { getViewRange, type CalendarView } from "@/lib/events/date-range";

export const dynamic = "force-dynamic";

const VIEW_VALUES: CalendarView[] = ["month", "week", "day"];

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login");
  }

  const resolvedParams = await searchParams;
  const requestedView = normalizeViewParam(resolvedParams.view);
  const requestedDate =
    (Array.isArray(resolvedParams.date) ? resolvedParams.date[0] : resolvedParams.date) ??
    "";

  const referenceDate = normalizeDate(requestedDate);
  const view = requestedView ?? "month";

  const { from, to } = getViewRange(view, referenceDate);
  const rangeFilter = {
    startAt: { lte: to },
    endAt: { gte: from },
  };

  const accessFilter = buildEventAccessFilter({
    role: session.user.role ?? "LAWYER",
    userId: session.user.id,
  });

  const whereClauses = [];
  if (Object.keys(accessFilter).length > 0) {
    whereClauses.push(accessFilter);
  }
  whereClauses.push(rangeFilter);

  const where =
    whereClauses.length > 0
      ? {
          AND: whereClauses,
        }
      : {};

  const [events, totalCount, matters, calendars] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { startAt: "asc" },
      include: eventDefaultInclude,
      take: 100,
    }),
    prisma.event.count({ where }),
    prisma.matter.findMany({
      where: buildMatterFilter(session.user),
      orderBy: { title: "asc" },
      select: { id: true, title: true },
      take: 100,
    }),
    prisma.calendar.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        provider: true,
        isPrimary: true,
        lastSyncedAt: true,
        defaultReminderMinutes: true,
      },
    }),
  ]);

  const initialData: EventsResponse = {
    data: events.map(serializeEvent),
    pagination: {
      page: 1,
      pageSize: 100,
      total: totalCount,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };

  const matterOptions: MatterOption[] = matters.map((matter) => ({
    id: matter.id,
    title: matter.title,
  }));

  const calendarOptions: CalendarOption[] = calendars.map((calendar) => ({
    id: calendar.id,
    name: calendar.name,
    provider: calendar.provider,
    isPrimary: calendar.isPrimary,
    lastSyncedAt: calendar.lastSyncedAt?.toISOString() ?? null,
    defaultReminderMinutes: calendar.defaultReminderMinutes,
  }));

  return (
    <EventsPageClient
      initialData={initialData}
      matters={matterOptions}
      calendars={calendarOptions}
      defaultView={view}
      defaultDateISO={referenceDate.toISOString()}
    />
  );
}

function normalizeViewParam(param: string | string[] | undefined): CalendarView | null {
  if (!param) return null;
  const value = Array.isArray(param) ? param[0] : param;
  if (VIEW_VALUES.includes(value as CalendarView)) {
    return value as CalendarView;
  }
  return null;
}

function normalizeDate(value: string) {
  if (!value) {
    return new Date();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
}

function buildMatterFilter(user: { id: string; role?: string | null }) {
  if (user.role === "ADMIN") {
    return {};
  }
  return {
    OR: [{ ownerId: user.id }],
  };
}
