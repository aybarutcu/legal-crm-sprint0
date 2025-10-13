import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import {
  buildEventAccessFilter,
  canModifyEvent,
  serializeEvent,
  type EventWithRelations,
} from "@/lib/events/service";

describe("buildEventAccessFilter", () => {
  it("returns empty filter for admin", () => {
    const filter = buildEventAccessFilter({
      role: Role.ADMIN,
      userId: "user-1",
    });
    expect(filter).toEqual({});
  });

  it("includes matter ownership for lawyers", () => {
    const filter = buildEventAccessFilter({
      role: Role.LAWYER,
      userId: "lawyer-1",
    });
    expect(filter).toEqual({
      OR: [
        { organizerId: "lawyer-1" },
        { calendar: { userId: "lawyer-1" } },
        { matter: { ownerId: "lawyer-1" } },
      ],
    });
  });

  it("falls back to task assignment for paralegals", () => {
    const filter = buildEventAccessFilter({
      role: Role.PARALEGAL,
      userId: "para-1",
    });
    expect(filter).toEqual({
      OR: [
        { organizerId: "para-1" },
        { calendar: { userId: "para-1" } },
        { matter: { tasks: { some: { assigneeId: "para-1" } } } },
      ],
    });
  });
});

describe("canModifyEvent", () => {
  const baseEvent: EventWithRelations = {
    id: "event-1",
    organizerId: "organizer-1",
    calendarId: "calendar-1",
    matterId: "matter-1",
    title: "Review",
    description: null,
    startAt: new Date("2024-10-10T10:00:00.000Z"),
    endAt: new Date("2024-10-10T11:00:00.000Z"),
    location: null,
    reminderMinutes: 30,
    attendees: [],
    externalCalId: null,
    externalEtag: null,
    reminderSentAt: null,
    createdAt: new Date("2024-10-01T10:00:00.000Z"),
    updatedAt: new Date("2024-10-01T10:00:00.000Z"),
    calendar: {
      id: "calendar-1",
      name: "Primary",
      provider: "LOCAL",
      userId: "calendar-owner",
      externalId: "primary@example.com",
    },
    organizer: {
      id: "organizer-1",
      name: "Lead Lawyer",
      email: "organizer@example.com",
    },
    matter: {
      id: "matter-1",
      title: "Matter",
      ownerId: "matter-owner",
    },
  };

  it("allows admin modification", () => {
    expect(
      canModifyEvent({
        event: baseEvent,
        userId: "any",
        role: Role.ADMIN,
      }),
    ).toBe(true);
  });

  it("allows organizer modification", () => {
    expect(
      canModifyEvent({
        event: baseEvent,
        userId: "organizer-1",
        role: Role.LAWYER,
      }),
    ).toBe(true);
  });

  it("denies when user has no relation", () => {
    expect(
      canModifyEvent({
        event: baseEvent,
        userId: "unrelated",
        role: Role.LAWYER,
      }),
    ).toBe(false);
  });
});

describe("serializeEvent", () => {
  it("normalizes optional fields", () => {
    const event: EventWithRelations = {
      id: "evt",
      title: "Consultation",
      description: null,
      startAt: new Date("2024-10-10T09:00:00.000Z"),
      endAt: new Date("2024-10-10T10:00:00.000Z"),
      location: null,
      reminderMinutes: 30,
      attendees: [
        { email: "client@example.com", name: "Client" },
        { email: "co@example.com" },
      ],
      organizerId: "user-1",
      calendarId: "cal-1",
      matterId: null,
      externalCalId: null,
      externalEtag: null,
      reminderSentAt: null,
      createdAt: new Date("2024-10-01T09:00:00.000Z"),
      updatedAt: new Date("2024-10-01T09:00:00.000Z"),
      calendar: {
        id: "cal-1",
        name: "Primary",
        provider: "LOCAL",
        userId: "user-1",
        externalId: "cal-1@local",
      },
      organizer: {
        id: "user-1",
        name: "Admin",
        email: "user@example.com",
      },
      matter: null,
    };

    const serialized = serializeEvent(event);
    expect(serialized.attendees).toHaveLength(2);
    expect(serialized.startAt).toBe("2024-10-10T09:00:00.000Z");
    expect(serialized.calendar).toEqual({
      id: "cal-1",
      name: "Primary",
      provider: "LOCAL",
    });
    expect(serialized.organizer).toEqual({
      id: "user-1",
      name: "Admin",
      email: "user@example.com",
    });
  });
});
