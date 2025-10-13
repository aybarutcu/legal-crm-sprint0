import { describe, expect, it } from "vitest";
import { calendarSyncSchema, calendarUpdateSchema } from "@/lib/validation/calendar";

describe("calendarSyncSchema", () => {
  it("accepts empty payload", () => {
    const parsed = calendarSyncSchema.parse({});
    expect(parsed.calendarId).toBeUndefined();
    expect(parsed.forceFull).toBeUndefined();
  });

  it("validates calendarId string", () => {
    const parsed = calendarSyncSchema.parse({
      calendarId: "cal-123",
      forceFull: true,
    });
    expect(parsed.calendarId).toBe("cal-123");
    expect(parsed.forceFull).toBe(true);
  });
});

describe("calendarUpdateSchema", () => {
  it("allows updating default reminder", () => {
    const parsed = calendarUpdateSchema.parse({
      defaultReminderMinutes: 45,
    });
    expect(parsed.defaultReminderMinutes).toBe(45);
  });

  it("rejects invalid reminder", () => {
    const result = calendarUpdateSchema.safeParse({
      defaultReminderMinutes: 2000,
    });
    expect(result.success).toBe(false);
  });
});
