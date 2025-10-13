import "@/lib/events/reminder-worker";
import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { recordAuditLog } from "@/lib/audit";
import {
  buildEventAccessFilter,
  eventDefaultInclude,
  serializeEvent,
} from "@/lib/events/service";
import {
  eventCreateSchema,
  eventQuerySchema,
  EventQueryInput,
} from "@/lib/validation/event";
import { enqueueEventSync } from "@/lib/events/sync";

export const GET = withApiHandler(async (req, { session }) => {
  const user = session!.user!;
  const queryParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const filters = eventQuerySchema.parse(queryParams);

  const where = buildWhereClause({
    filters,
    userId: user.id,
    role: user.role ?? Role.LAWYER,
  });

  const skip = (filters.page - 1) * filters.pageSize;

  const [items, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { startAt: "asc" },
      skip,
      take: filters.pageSize,
      include: eventDefaultInclude,
    }),
    prisma.event.count({ where }),
  ]);

  return NextResponse.json({
    data: items.map(serializeEvent),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
      hasNext: skip + filters.pageSize < total,
      hasPrev: filters.page > 1,
    },
  });
});

export const POST = withApiHandler(async (req, { session }) => {
  const user = session!.user!;
  const payload = eventCreateSchema.parse(await req.json());

  await ensureMatterExists(payload.matterId);
  const calendarId = await resolveCalendarId({
    requestedCalendarId: payload.calendarId,
    userId: user.id,
    role: user.role ?? Role.LAWYER,
  });

  const created = await prisma.event.create({
    data: {
      title: payload.title,
      description: payload.description,
      startAt: payload.startAt,
      endAt: payload.endAt,
      location: payload.location,
      reminderMinutes: payload.reminderMinutes,
      attendees: payload.attendees as unknown as Prisma.JsonArray,
      matterId: payload.matterId ?? undefined,
      organizerId: user.id,
      calendarId: calendarId ?? undefined,
    },
    include: eventDefaultInclude,
  });

  await recordAuditLog({
    actorId: user.id,
    action: "event.create",
    entityType: "event",
    entityId: created.id,
    metadata: {
      title: created.title,
      startAt: created.startAt,
      endAt: created.endAt,
      calendarId,
      matterId: created.matterId,
    },
  });

  if (created.calendarId) {
    await enqueueEventSync({
      event: created,
      actorId: user.id,
    }).catch((error) => {
      console.error("Failed to enqueue event sync", {
        eventId: created.id,
        error,
      });
    });
  }

  return NextResponse.json(serializeEvent(created), { status: 201 });
});

function buildWhereClause({
  filters,
  userId,
  role,
}: {
  filters: EventQueryInput;
  userId: string;
  role: Role;
}): Prisma.EventWhereInput {
  const clauses: Prisma.EventWhereInput[] = [];

  const accessFilter = buildEventAccessFilter({ role, userId });
  if (Object.keys(accessFilter).length > 0) {
    clauses.push(accessFilter);
  }

  if (filters.q) {
    clauses.push({
      OR: [
        { title: { contains: filters.q, mode: "insensitive" } },
        { description: { contains: filters.q, mode: "insensitive" } },
        { location: { contains: filters.q, mode: "insensitive" } },
      ],
    });
  }

  if (filters.matterId) {
    clauses.push({ matterId: filters.matterId });
  }

  if (filters.attendee) {
    clauses.push({
      attendees: {
        array_contains: [{ email: filters.attendee }] as Prisma.JsonArray,
      },
    });
  }

  if (filters.from) {
    clauses.push({ endAt: { gte: filters.from } });
  }

  if (filters.to) {
    clauses.push({ startAt: { lte: filters.to } });
  }

  if (clauses.length === 0) {
    return {};
  }

  return { AND: clauses };
}

async function resolveCalendarId({
  requestedCalendarId,
  userId,
  role,
}: {
  requestedCalendarId?: string;
  userId: string;
  role: Role;
}) {
  if (requestedCalendarId) {
    const calendar = await prisma.calendar.findUnique({
      where: { id: requestedCalendarId },
    });

    if (!calendar) {
      const error = new Error("Calendar not found");
      // @ts-expect-error annotate HTTP status
      error.status = 404;
      throw error;
    }

    if (calendar.userId !== userId && role !== "ADMIN") {
      const error = new Error("Forbidden");
      // @ts-expect-error annotate HTTP status
      error.status = 403;
      throw error;
    }

    return calendar.id;
  }

  const primary = await prisma.calendar.findFirst({
    where: { userId, isPrimary: true },
    select: { id: true },
  });

  return primary?.id ?? null;
}

async function ensureMatterExists(matterId?: string | null) {
  if (!matterId) return;

  const exists = await prisma.matter.findUnique({
    where: { id: matterId },
    select: { id: true },
  });

  if (!exists) {
    const error = new Error("Matter not found");
    // @ts-expect-error annotate HTTP status
    error.status = 404;
    throw error;
  }
}
