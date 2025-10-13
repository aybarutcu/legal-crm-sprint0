import { subMonths } from "date-fns";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { EventWithRelations } from "@/lib/events/service";
import {
  deleteEventFromGoogle,
  listGoogleCalendarEvents,
  pushEventToGoogle,
} from "@/lib/google/calendar";

type EventSyncResult = {
  status: "queued";
  eventId: string;
  calendarId: string | null;
  force: boolean;
};

export async function enqueueEventSync({
  event,
  actorId,
  force = false,
}: {
  event: EventWithRelations;
  actorId: string;
  force?: boolean;
}): Promise<EventSyncResult> {
  const calendarId = event.calendarId ?? null;
  if (!calendarId) {
    return {
      status: "queued",
      eventId: event.id,
      calendarId: null,
      force,
    };
  }

  const calendar = await prisma.calendar.findUnique({
    where: { id: calendarId },
    select: {
      id: true,
      provider: true,
      externalId: true,
      userId: true,
    },
  });

  if (!calendar) {
    return {
      status: "queued",
      eventId: event.id,
      calendarId,
      force,
    };
  }

  if (calendar.provider !== "GOOGLE" || !calendar.externalId) {
    await prisma.calendar.update({
      where: { id: calendar.id },
      data: { lastSyncedAt: new Date() },
    });
    return {
      status: "queued",
      eventId: event.id,
      calendarId: calendar.id,
      force,
    };
  }

  const pushResult = await pushEventToGoogle({
    event,
    calendarExternalId: calendar.externalId,
    calendarUserId: calendar.userId,
  });

  await prisma.event.update({
    where: { id: event.id },
    data: {
      externalCalId: pushResult.id ?? event.externalCalId,
      externalEtag: pushResult.etag ?? null,
    },
  });

  await prisma.calendar.update({
    where: { id: calendar.id },
    data: { lastSyncedAt: new Date() },
  });

  console.info("[sync] Event pushed to Google", {
    eventId: event.id,
    calendarId: calendar.id,
  });

  return {
    status: "queued",
    eventId: event.id,
    calendarId: calendar.id,
    force,
  };
}

type UserCalendarSyncResult = {
  status: "queued" | "noop";
  calendarIds: string[];
  forceFull: boolean;
};

export async function performUserCalendarSync({
  actorId,
  actorRole,
  calendarId,
  forceFull = false,
}: {
  actorId: string;
  actorRole?: Role | null;
  calendarId?: string | null;
  forceFull?: boolean;
}): Promise<UserCalendarSyncResult> {
  const effectiveRole = actorRole ?? "LAWYER";

  const calendars = await prisma.calendar.findMany({
    where: calendarId ? { id: calendarId } : { userId: actorId },
    select: {
      id: true,
      userId: true,
      provider: true,
      externalId: true,
      syncToken: true,
      defaultReminderMinutes: true,
    },
  });

  if (calendars.length === 0) {
    return { status: "noop", calendarIds: [], forceFull };
  }

  if (
    effectiveRole !== "ADMIN" &&
    calendars.some((calendar) => calendar.userId !== actorId)
  ) {
    const error = new Error("Forbidden");
    // @ts-expect-error annotate HTTP status
    error.status = 403;
    throw error;
  }

  const now = new Date();
  const calendarIds: string[] = [];

  for (const calendar of calendars) {
    calendarIds.push(calendar.id);

    if (calendar.provider !== "GOOGLE" || !calendar.externalId) {
      await prisma.calendar.update({
        where: { id: calendar.id },
        data: {
          lastSyncedAt: now,
          ...(forceFull ? { syncToken: null } : {}),
        },
      });
      continue;
    }

    const { items, nextSyncToken } = await listGoogleCalendarEvents({
      calendarExternalId: calendar.externalId,
      calendarUserId: calendar.userId,
      syncToken: forceFull ? undefined : calendar.syncToken,
      fallbackTimeMin: subMonths(now, 3).toISOString(),
    });

    for (const googleEvent of items) {
      if (!googleEvent.id) continue;

      if (googleEvent.status === "cancelled") {
        await prisma.event.deleteMany({
          where: {
            calendarId: calendar.id,
            externalCalId: googleEvent.id,
          },
        });
        continue;
      }

      const startAt = extractGoogleDate(googleEvent.start);
      const endAt = extractGoogleDate(googleEvent.end);
      if (!startAt || !endAt) continue;

      const attendees = buildAttendeesJson(googleEvent.attendees);
      const reminderMinutes = resolveReminderMinutes(
        googleEvent.reminders,
        calendar.defaultReminderMinutes,
      );

      const existing = await prisma.event.findFirst({
        where: {
          calendarId: calendar.id,
          externalCalId: googleEvent.id,
        },
      });

      if (existing) {
        await prisma.event.update({
          where: { id: existing.id },
          data: {
            title: googleEvent.summary ?? existing.title,
            description: googleEvent.description ?? undefined,
            location: googleEvent.location ?? undefined,
            startAt,
            endAt,
            attendees,
            reminderMinutes,
            externalEtag: googleEvent.etag ?? null,
          },
        });
      } else {
        await prisma.event.create({
          data: {
            title: googleEvent.summary ?? "Google Etkinliği",
            description: googleEvent.description ?? null,
            location: googleEvent.location ?? null,
            startAt,
            endAt,
            attendees,
            reminderMinutes,
            calendarId: calendar.id,
            organizerId: calendar.userId,
            externalCalId: googleEvent.id,
            externalEtag: googleEvent.etag ?? null,
          },
        });
      }
    }

    await prisma.calendar.update({
      where: { id: calendar.id },
      data: {
        lastSyncedAt: now,
        syncToken: nextSyncToken ?? (forceFull ? null : calendar.syncToken),
      },
    });

    console.info("[sync] Calendar refreshed", {
      calendarId: calendar.id,
      imported: items.length,
      forceFull,
    });
  }

  return {
    status: "queued",
    calendarIds,
    forceFull,
  };
}

type WebhookResult =
  | { status: "ignored"; reason: string }
  | { status: "queued"; calendarId: string };

export async function handleGoogleWebhookNotification({
  headers,
}: {
  headers: Record<string, string | undefined>;
}): Promise<WebhookResult> {
  const channelId = headers["x-goog-channel-id"];
  const resourceId = headers["x-goog-resource-id"];

  if (!channelId || !resourceId) {
    return { status: "ignored", reason: "missing_identifiers" };
  }

  const calendar = await prisma.calendar.findFirst({
    where: {
      webhookChannelId: channelId,
      webhookResourceId: resourceId,
    },
    select: { id: true, userId: true, provider: true, externalId: true },
  });

  if (!calendar) {
    return { status: "ignored", reason: "calendar_not_registered" };
  }

  if (calendar.provider === "GOOGLE" && calendar.externalId) {
    try {
      await performUserCalendarSync({
        actorId: calendar.userId,
        actorRole: "ADMIN",
        calendarId: calendar.id,
      });
    } catch (error) {
      console.error("Google webhook sync failed", {
        calendarId: calendar.id,
        error,
      });
    }
  }

  await prisma.calendar.update({
    where: { id: calendar.id },
    data: {
      lastSyncedAt: new Date(),
    },
  });

  return { status: "queued", calendarId: calendar.id };
}

export async function deleteEventFromGoogleCalendar(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      calendar: {
        select: {
          id: true,
          provider: true,
          externalId: true,
          userId: true,
        },
      },
    },
  });

  if (!event?.calendar || !event.externalCalId) return;

  if (event.calendar.provider !== "GOOGLE" || !event.calendar.externalId) return;

  await deleteEventFromGoogle({
    calendarExternalId: event.calendar.externalId,
    calendarUserId: event.calendar.userId,
    externalEventId: event.externalCalId,
  });
}

function extractGoogleDate(value?: {
  date?: string;
  dateTime?: string;
  timeZone?: string;
}): Date | null {
  if (!value) return null;
  if (value.dateTime) {
    const parsed = new Date(value.dateTime);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value.date) {
    const parsed = new Date(`${value.date}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function buildAttendeesJson(
  attendees?: Array<{ email?: string; displayName?: string }>,
) {
  if (!attendees) return [] as Prisma.JsonArray;
  const mapped = attendees
    .map((attendee) => {
      if (!attendee.email) return null;
      return {
        email: attendee.email,
        ...(attendee.displayName ? { name: attendee.displayName } : {}),
      };
    })
    .filter(Boolean);
  return mapped as Prisma.JsonArray;
}

function resolveReminderMinutes(
  reminders:
    | {
        useDefault?: boolean;
        overrides?: Array<{ method?: string; minutes?: number }>;
      }
    | undefined,
  fallback: number,
) {
  if (!reminders?.overrides || reminders.overrides.length === 0) {
    return fallback;
  }
  const override = reminders.overrides.find((item) =>
    typeof item.minutes === "number"
  );
  return override?.minutes ?? fallback;
}
