import { describe, expect, it } from "vitest";
import {
  eventAttendeeSchema,
  eventCreateSchema,
  eventQuerySchema,
  eventUpdateSchema,
  eventSyncSchema,
} from "@/lib/validation/event";

describe("eventAttendeeSchema", () => {
  it("accepts valid attendee", () => {
    const parsed = eventAttendeeSchema.safeParse({
      email: "attendee@example.com",
      name: "Jane Client",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const parsed = eventAttendeeSchema.safeParse({
      email: "not-an-email",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("eventCreateSchema", () => {
  it("parses valid payload and applies defaults", () => {
    const startAt = new Date("2024-10-10T09:00:00.000Z");
    const endAt = new Date("2024-10-10T10:00:00.000Z");

    const parsed = eventCreateSchema.parse({
      title: "Client meeting",
      startAt,
      endAt,
    });

    expect(parsed.attendees).toEqual([]);
    expect(parsed.reminderMinutes).toBeGreaterThanOrEqual(0);
    expect(parsed.endAt.getTime()).toBe(endAt.getTime());
  });

  it("rejects when endAt is before startAt", () => {
    const result = eventCreateSchema.safeParse({
      title: "Invalid event",
      startAt: new Date("2024-10-10T12:00:00.000Z"),
      endAt: new Date("2024-10-10T11:00:00.000Z"),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.format().endAt?._errors).toContain(
        "endAt must be after startAt",
      );
    }
  });
});

describe("eventUpdateSchema", () => {
  it("allows partial updates", () => {
    const result = eventUpdateSchema.safeParse({
      title: "Updated title",
      reminderMinutes: 45,
    });
    expect(result.success).toBe(true);
  });

  it("validates start/end ordering when both provided", () => {
    const result = eventUpdateSchema.safeParse({
      startAt: new Date("2024-10-10T10:00:00.000Z"),
      endAt: new Date("2024-10-10T09:00:00.000Z"),
    });
    expect(result.success).toBe(false);
  });
});

describe("eventQuerySchema", () => {
  it("applies defaults for pagination", () => {
    const parsed = eventQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(50);
    expect(parsed.view).toBe("month");
  });
});

describe("eventSyncSchema", () => {
  it("allows optional force flag", () => {
    const parsed = eventSyncSchema.parse({ force: true });
    expect(parsed.force).toBe(true);
  });

  it("parses empty payload", () => {
    const parsed = eventSyncSchema.parse({});
    expect(parsed.force).toBeUndefined();
  });
});
