import { afterEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import {
  enqueueEventSync,
  handleGoogleWebhookNotification,
  performUserCalendarSync,
} from "@/lib/events/sync";
import type { EventWithRelations } from "@/lib/events/service";

const prismaMocks = vi.hoisted(() => {
  const calendarFindUnique = vi.fn();
  const calendarUpdate = vi.fn();
  const calendarFindMany = vi.fn();
  const calendarUpdateMany = vi.fn();
  const calendarFindFirst = vi.fn();
  const eventUpdate = vi.fn();
  const eventFindFirst = vi.fn();
  const eventCreate = vi.fn();
  const eventDeleteMany = vi.fn();

  return {
    calendarFindUnique,
    calendarUpdate,
    calendarFindMany,
    calendarUpdateMany,
    calendarFindFirst,
    eventUpdate,
    eventFindFirst,
    eventCreate,
    eventDeleteMany,
  };
});

const googleMocks = vi.hoisted(() => {
  const pushEventToGoogle = vi.fn();
  const listGoogleCalendarEvents = vi.fn();
  const deleteEventFromGoogle = vi.fn();
  return {
    pushEventToGoogle,
    listGoogleCalendarEvents,
    deleteEventFromGoogle,
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendar: {
      findUnique: prismaMocks.calendarFindUnique,
      update: prismaMocks.calendarUpdate,
      findMany: prismaMocks.calendarFindMany,
      updateMany: prismaMocks.calendarUpdateMany,
      findFirst: prismaMocks.calendarFindFirst,
    },
    event: {
      update: prismaMocks.eventUpdate,
      findFirst: prismaMocks.eventFindFirst,
      create: prismaMocks.eventCreate,
      deleteMany: prismaMocks.eventDeleteMany,
    },
  },
}));

vi.mock("@/lib/google/calendar", () => ({
  pushEventToGoogle: googleMocks.pushEventToGoogle,
  listGoogleCalendarEvents: googleMocks.listGoogleCalendarEvents,
  deleteEventFromGoogle: googleMocks.deleteEventFromGoogle,
}));

const {
  calendarFindUnique,
  calendarUpdate,
  calendarFindMany,
  calendarUpdateMany,
  calendarFindFirst,
  eventUpdate,
  eventFindFirst,
  eventCreate,
  eventDeleteMany,
} = prismaMocks;

const { pushEventToGoogle, listGoogleCalendarEvents } = googleMocks;

afterEach(() => {
  vi.clearAllMocks();
});

describe("enqueueEventSync", () => {
  it("pushes event to Google when calendar is external", async () => {
    calendarFindUnique.mockResolvedValueOnce({
      id: "cal-1",
      provider: "GOOGLE",
      externalId: "primary@google",
      userId: "user-1",
    });
    pushEventToGoogle.mockResolvedValueOnce({ id: "google-event", etag: "etag" });
    eventUpdate.mockResolvedValueOnce({});
    calendarUpdate.mockResolvedValueOnce({});

    const event: EventWithRelations = {
      id: "event-1",
      organizerId: "user-1",
      organizer: { id: "user-1", name: "User", email: "user@example.com" },
      calendarId: "cal-1",
      matterId: null,
      title: "Toplantı",
      description: null,
      startAt: new Date("2024-10-10T09:00:00.000Z"),
      endAt: new Date("2024-10-10T10:00:00.000Z"),
      location: null,
      reminderMinutes: 30,
      attendees: [],
      externalCalId: null,
      externalEtag: null,
      reminderSentAt: null,
      createdAt: new Date("2024-10-01T09:00:00.000Z"),
      updatedAt: new Date("2024-10-01T09:00:00.000Z"),
      calendar: {
        id: "cal-1",
        name: "Primary",
        provider: "GOOGLE",
        userId: "user-1",
        externalId: "primary@google",
      },
      matter: null,
    };

    const result = await enqueueEventSync({
      event,
      actorId: "user-1",
    });

    expect(pushEventToGoogle).toHaveBeenCalled();
    expect(eventUpdate).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: { externalCalId: "google-event", externalEtag: "etag" },
    });
    expect(result.calendarId).toBe("cal-1");
  });
});

describe("performUserCalendarSync", () => {
  it("imports updates from Google", async () => {
    calendarFindMany.mockResolvedValueOnce([
      {
        id: "cal-1",
        userId: "user-1",
        provider: "GOOGLE",
        externalId: "primary@google",
        syncToken: null,
        defaultReminderMinutes: 30,
      },
    ]);
    listGoogleCalendarEvents.mockResolvedValueOnce({
      items: [
        {
          id: "google-event",
          status: "confirmed",
          summary: "Google Meeting",
          start: { dateTime: "2024-10-10T12:00:00.000Z" },
          end: { dateTime: "2024-10-10T13:00:00.000Z" },
          reminders: { overrides: [{ method: "email", minutes: 15 }] },
        },
      ],
      nextSyncToken: "token",
    });
    eventFindFirst.mockResolvedValueOnce(null);
    eventCreate.mockResolvedValueOnce({});
    calendarUpdate.mockResolvedValueOnce({});

    const result = await performUserCalendarSync({
      actorId: "user-1",
      actorRole: Role.ADMIN,
      forceFull: false,
    });

    expect(listGoogleCalendarEvents).toHaveBeenCalled();
    expect(eventCreate).toHaveBeenCalled();
    expect(calendarUpdate).toHaveBeenCalled();
    expect(result).toEqual({ status: "queued", calendarIds: ["cal-1"], forceFull: false });
  });
});

describe("handleGoogleWebhookNotification", () => {
  it("ignores missing headers", async () => {
    const result = await handleGoogleWebhookNotification({ headers: {} });
    expect(result).toEqual({ status: "ignored", reason: "missing_identifiers" });
  });

  it("kicks off sync when calendar registered", async () => {
    calendarFindFirst.mockResolvedValueOnce({
      id: "cal-1",
      userId: "user-1",
      provider: "GOOGLE",
      externalId: "primary@google",
    });
    calendarUpdate.mockResolvedValueOnce({});
    calendarFindMany.mockResolvedValueOnce([]);

    const result = await handleGoogleWebhookNotification({
      headers: {
        "x-goog-channel-id": "channel",
        "x-goog-resource-id": "resource",
      },
    });

    expect(result).toEqual({ status: "queued", calendarId: "cal-1" });
  });
});
