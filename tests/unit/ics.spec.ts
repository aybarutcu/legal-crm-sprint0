import { describe, expect, it } from "vitest";
import { buildIcsUrl, createIcsToken, generateIcs, hashToken } from "@/lib/events/ics";

describe("ICS helpers", () => {
  it("generates hashed tokens", () => {
    const { token, hash } = createIcsToken();
    expect(token).toBeTruthy();
    expect(hash).toBe(hashToken(token));
    expect(hash).not.toBe(token);
  });

  it("builds ICS URL", () => {
    const url = buildIcsUrl("abc");
    expect(url).toContain("abc");
    expect(url.startsWith("http")).toBe(true);
  });

  it("renders VCALENDAR structure", () => {
    const now = new Date("2024-10-10T09:00:00.000Z");
    const ics = generateIcs([
      {
        id: "evt-1",
        title: "Deneme",
        description: "Açıklama",
        location: "Salon",
        startAt: now,
        endAt: new Date(now.getTime() + 60 * 60 * 1000),
        updatedAt: now,
      } as unknown as Parameters<typeof generateIcs>[0][number],
    ]);

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("SUMMARY:Deneme");
    expect(ics).toContain("END:VCALENDAR");
  });
});
