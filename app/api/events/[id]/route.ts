import "@/lib/events/reminder-worker";
import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { recordAuditLog } from "@/lib/audit";
import {
  assertCanModifyEvent,
  buildEventAccessFilter,
  eventDefaultInclude,
  serializeEvent,
} from "@/lib/events/service";
import { eventUpdateSchema } from "@/lib/validation/event";
import {
  enqueueEventSync,
  deleteEventFromGoogleCalendar,
} from "@/lib/events/sync";

export const GET = withApiHandler<{ id: string }>(async (_, { params, session }) => {
  const user = session!.user!;
  const event = await prisma.event.findFirst({
    where: {
      AND: [
        { id: params!.id },
        ...buildAccessClauses(user.id, user.role ?? Role.LAWYER),
      ],
    },
    include: eventDefaultInclude,
  });

  if (!event) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  return NextResponse.json(serializeEvent(event));
});

export const PATCH = withApiHandler<{ id: string }>(async (req, { params, session }) => {
  const user = session!.user!;
  const payload = eventUpdateSchema.parse(await req.json());

  if (Object.keys(payload).length === 0) {
    const error = new Error("No fields provided");
    // @ts-expect-error annotate HTTP status
    error.status = 400;
    throw error;
  }

  const existing = await prisma.event.findUnique({
    where: { id: params!.id },
    include: eventDefaultInclude,
  });

  if (!existing) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  assertCanModifyEvent({
    event: existing,
    userId: user.id,
    role: user.role,
  });

  if (payload.matterId) {
    await ensureMatterExists(payload.matterId);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "calendarId")) {
    await ensureCalendarAccess({
      calendarId: payload.calendarId,
      userId: user.id,
      role: user.role ?? Role.LAWYER,
    });
  }

  const shouldDeleteFromGoogle =
    Boolean(existing.externalCalId) &&
    Object.prototype.hasOwnProperty.call(payload, "calendarId") &&
    (payload.calendarId === null || payload.calendarId !== existing.calendarId);

  if (shouldDeleteFromGoogle) {
    await deleteEventFromGoogleCalendar(existing.id).catch((error) => {
      console.error("Failed to delete Google event before update", {
        eventId: existing.id,
        error,
      });
    });
  }

  const data: Prisma.EventUpdateInput = {};

  if (payload.title !== undefined) data.title = payload.title;
  if (payload.description !== undefined)
    data.description = payload.description ?? null;
  if (payload.startAt) data.startAt = payload.startAt;
  if (payload.endAt) data.endAt = payload.endAt;
  if (payload.location !== undefined)
    data.location = payload.location ?? null;
  if (payload.reminderMinutes !== undefined)
    data.reminderMinutes = payload.reminderMinutes;
  if (payload.attendees !== undefined) {
    data.attendees = payload.attendees as unknown as Prisma.JsonArray;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "matterId")) {
    data.matter = payload.matterId
      ? { connect: { id: payload.matterId } }
      : { disconnect: true };
  }
  if (Object.prototype.hasOwnProperty.call(payload, "calendarId")) {
    data.calendar = payload.calendarId
      ? { connect: { id: payload.calendarId } }
      : { disconnect: true };
    if (!payload.calendarId) {
      data.externalCalId = null;
      data.externalEtag = null;
    }
  }

  if (
    payload.startAt ||
    payload.reminderMinutes !== undefined ||
    shouldDeleteFromGoogle
  ) {
    data.reminderSentAt = null;
  }

  const updated = await prisma.event.update({
    where: { id: params!.id },
    data,
    include: eventDefaultInclude,
  });

  await recordAuditLog({
    actorId: user.id,
    action: "event.update",
    entityType: "event",
    entityId: updated.id,
    metadata: {
      changes: payload,
    },
  });

  if (updated.calendarId) {
    await enqueueEventSync({
      event: updated,
      actorId: user.id,
    }).catch((error) => {
      console.error("Failed to sync updated event", {
        eventId: updated.id,
        error,
      });
    });
  }

  return NextResponse.json(serializeEvent(updated));
});

export const DELETE = withApiHandler<{ id: string }>(async (_, { params, session }) => {
  const user = session!.user!;
  const existing = await prisma.event.findUnique({
    where: { id: params!.id },
    include: eventDefaultInclude,
  });

  if (!existing) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  assertCanModifyEvent({
    event: existing,
    userId: user.id,
    role: user.role,
  });

  if (existing.externalCalId) {
    await deleteEventFromGoogleCalendar(existing.id).catch((error) => {
      console.error("Failed to delete Google event", {
        eventId: existing.id,
        error,
      });
    });
  }

  await prisma.event.delete({ where: { id: params!.id } });

  await recordAuditLog({
    actorId: user.id,
    action: "event.delete",
    entityType: "event",
    entityId: existing.id,
    metadata: {
      title: existing.title,
      startAt: existing.startAt,
      endAt: existing.endAt,
    },
  });

  return new NextResponse(null, { status: 204 });
});

function buildAccessClauses(userId: string, role: Role) {
  const filter = buildEventAccessFilter({ userId, role });
  return Object.keys(filter).length > 0 ? [filter] : [];
}

async function ensureMatterExists(matterId: string) {
  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    select: { id: true },
  });

  if (!matter) {
    const error = new Error("Matter not found");
    // @ts-expect-error annotate HTTP status
    error.status = 404;
    throw error;
  }
}

async function ensureCalendarAccess({
  calendarId,
  userId,
  role,
}: {
  calendarId: string | null | undefined;
  userId: string;
  role: Role;
}) {
  if (!calendarId) return;

  const calendar = await prisma.calendar.findUnique({
    where: { id: calendarId },
    select: { id: true, userId: true },
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
}
