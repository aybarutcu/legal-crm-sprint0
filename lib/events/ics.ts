import { randomBytes, createHash, createHmac } from "node:crypto";
import { format } from "date-fns";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildEventAccessFilter,
  eventDefaultInclude,
} from "@/lib/events/service";

const PRODID = "-//Legal CRM//Calendar//EN";

export function generateIcs(events: Awaited<
  ReturnType<typeof prisma.event.findMany>
>) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:${PRODID}`];

  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@legalcrm`);
    lines.push(`DTSTAMP:${formatUtc(new Date())}`);
    lines.push(`DTSTART:${formatUtc(event.startAt)}`);
    lines.push(`DTEND:${formatUtc(event.endAt)}`);
    lines.push(`SUMMARY:${escapeText(event.title)}`);
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    }
    if (event.location) {
      lines.push(`LOCATION:${escapeText(event.location)}`);
    }
    lines.push(`LAST-MODIFIED:${formatUtc(event.updatedAt)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function createIcsToken() {
  const token = randomBytes(32).toString("base64url");
  const hash = hashToken(token);
  return { token, hash };
}

export function hashToken(token: string) {
  const secret = process.env.ICS_SIGNING_SECRET ?? "default-secret";
  return createHash("sha256")
    .update(createHmac("sha256", secret).update(token).digest("hex"))
    .digest("hex");
}

export function buildIcsUrl(token: string) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000";
  return `${base}/api/calendar/ics?token=${token}`;
}

export async function fetchEventsForUser(userId: string, role?: Role | null) {
  const filter = buildEventAccessFilter({ userId, role });
  const now = new Date();
  const oneYearAhead = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  const where =
    Object.keys(filter).length > 0
      ? { AND: [filter, { startAt: { lte: oneYearAhead } }] }
      : { startAt: { lte: oneYearAhead } };

  const events = await prisma.event.findMany({
    where,
    include: eventDefaultInclude,
    orderBy: { startAt: "asc" },
  });

  return events;
}

export async function getPrimaryCalendar(userId: string) {
  const calendar = await prisma.calendar.findFirst({
    where: { userId },
    orderBy: [
      { isPrimary: "desc" },
      { createdAt: "asc" },
    ],
  });

  if (calendar) return calendar;

  return prisma.calendar.create({
    data: {
      userId,
      name: "Primary Calendar",
      provider: "LOCAL",
      isPrimary: true,
    },
  });
}

function formatUtc(date: Date) {
  return format(date, "yyyyMMdd'T'HHmmss'Z'");
}

function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}
