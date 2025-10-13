import { afterEach, describe, expect, it, vi } from "vitest";
import { scanAndSendReminders } from "@/lib/events/reminder-service";

const prismaMocks = vi.hoisted(() => {
  const eventFindMany = vi.fn();
  const eventUpdate = vi.fn();
  return { eventFindMany, eventUpdate };
});

const mailerMock = vi.hoisted(() => {
  const sendMail = vi.fn().mockResolvedValue({});
  return { sendMail };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: {
      findMany: prismaMocks.eventFindMany,
      update: prismaMocks.eventUpdate,
    },
  },
}));

vi.mock("@/lib/mail/transporter", () => ({
  getMailer: () => mailerMock,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("scanAndSendReminders", () => {
  it("sends reminders for upcoming events", async () => {
    const now = new Date("2024-10-10T08:00:00.000Z");
    prismaMocks.eventFindMany.mockResolvedValueOnce([
      {
        id: "evt-1",
        title: "Durusma",
        description: null,
        location: "Adliye",
        reminderMinutes: 30,
        reminderSentAt: null,
        startAt: new Date("2024-10-10T08:20:00.000Z"),
        endAt: new Date("2024-10-10T09:20:00.000Z"),
        attendees: [{ email: "katilimci@example.com" }],
        organizer: { id: "user-1", email: "user@example.com", name: "Kullanici" },
        matter: { id: "matter-1", title: "Dosya" },
        calendar: null,
        updatedAt: now,
      },
    ]);

    prismaMocks.eventUpdate.mockResolvedValueOnce({});

    const result = await scanAndSendReminders(now);

    expect(mailerMock.sendMail).toHaveBeenCalledTimes(1);
    expect(prismaMocks.eventUpdate).toHaveBeenCalledWith({
      where: { id: "evt-1" },
      data: { reminderSentAt: now },
    });
    expect(result.sent).toBe(1);
  });

  it("skips events without recipients", async () => {
    const now = new Date();
    prismaMocks.eventFindMany.mockResolvedValueOnce([
      {
        id: "evt-2",
        title: "Toplanti",
        description: null,
        location: null,
        reminderMinutes: 10,
        reminderSentAt: null,
        startAt: new Date(now.getTime() + 5 * 60 * 1000),
        endAt: new Date(now.getTime() + 35 * 60 * 1000),
        attendees: [],
        organizer: { id: "user-1", email: null, name: "Kullanici" },
        matter: null,
        calendar: null,
        updatedAt: now,
      },
    ]);

    prismaMocks.eventUpdate.mockResolvedValueOnce({});

    const result = await scanAndSendReminders(now);

    expect(mailerMock.sendMail).not.toHaveBeenCalled();
    expect(prismaMocks.eventUpdate).toHaveBeenCalled();
    expect(result.sent).toBe(0);
  });
});
