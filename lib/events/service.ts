import { Prisma, Role } from "@prisma/client";

const EVENT_INCLUDE = {
  matter: {
    select: {
      id: true,
      title: true,
      ownerId: true,
    },
  },
  calendar: {
    select: {
      id: true,
      name: true,
      provider: true,
      userId: true,
      externalId: true,
    },
  },
  organizer: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.EventInclude;

export type EventWithRelations = Prisma.EventGetPayload<{
  include: typeof EVENT_INCLUDE;
}>;

export const eventDefaultInclude = EVENT_INCLUDE;

export function buildEventAccessFilter({
  role,
  userId,
}: {
  role?: Role | null;
  userId: string;
}): Prisma.EventWhereInput {
  const effectiveRole = role ?? "LAWYER";

  if (effectiveRole === "ADMIN") {
    return {};
  }

  const sharedAccess: Prisma.EventWhereInput[] = [
    { organizerId: userId },
    { calendar: { userId } },
  ];

  if (effectiveRole === "LAWYER") {
    sharedAccess.push({ matter: { ownerId: userId } });
  } else {
    sharedAccess.push({
      matter: {
        tasks: { some: { assigneeId: userId } },
      },
    });
  }

  return { OR: sharedAccess };
}

export function canModifyEvent({
  event,
  userId,
  role,
}: {
  event: EventWithRelations;
  userId: string;
  role?: Role | null;
}): boolean {
  if (role === "ADMIN") return true;
  if (event.organizerId === userId) return true;
  if (event.calendar?.userId === userId) return true;
  if (event.matter?.ownerId && event.matter.ownerId === userId) return true;
  return false;
}

export function assertCanModifyEvent(params: {
  event: EventWithRelations;
  userId: string;
  role?: Role | null;
}) {
  if (!canModifyEvent(params)) {
    const error = new Error("Forbidden");
    // @ts-expect-error augment status for centralized handler
    error.status = 403;
    throw error;
  }
}

type SerializedAttendee = {
  email: string;
  name?: string | null;
};

type SerializedEvent = {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  location: string | null;
  reminderMinutes: number;
  attendees: SerializedAttendee[];
  calendar: {
    id: string;
    name: string;
    provider: string;
  } | null;
  matter: {
    id: string;
    title: string;
  } | null;
  organizer: {
    id: string;
    name: string | null;
    email: string | null;
  };
  organizerId: string;
  calendarId: string | null;
  matterId: string | null;
  externalCalId: string | null;
  externalEtag: string | null;
  reminderSentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeEvent(event: EventWithRelations): SerializedEvent {
  const attendees = normalizeAttendees(event.attendees);

  return {
    id: event.id,
    title: event.title,
    description: event.description ?? null,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
    location: event.location ?? null,
    reminderMinutes: event.reminderMinutes,
    attendees,
    calendar: event.calendar
      ? {
          id: event.calendar.id,
          name: event.calendar.name,
          provider: event.calendar.provider,
        }
      : null,
    matter: event.matter
      ? {
          id: event.matter.id,
          title: event.matter.title,
        }
      : null,
    organizerId: event.organizerId,
    organizer: {
      id: event.organizer.id,
      name: event.organizer.name ?? null,
      email: event.organizer.email ?? null,
    },
    calendarId: event.calendarId ?? null,
    matterId: event.matterId ?? null,
    externalCalId: event.externalCalId ?? null,
    externalEtag: event.externalEtag ?? null,
    reminderSentAt: event.reminderSentAt
      ? event.reminderSentAt.toISOString()
      : null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

function normalizeAttendees(
  value: Prisma.JsonValue,
): SerializedAttendee[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Record<string, unknown>;
      const email = candidate.email;
      if (typeof email !== "string") return null;
      const attendee: SerializedAttendee = { email };
      if (typeof candidate.name === "string") {
        attendee.name = candidate.name;
      }
      return attendee;
    })
    .filter((attendee): attendee is SerializedAttendee => attendee !== null);
}
