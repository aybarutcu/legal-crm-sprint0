import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CalendarSettingsClient } from "@/components/settings/CalendarSettingsClient";
import type { CalendarOption } from "@/components/events/types";

export const dynamic = "force-dynamic";

export default async function CalendarSettingsPage() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login");
  }

  const userId = session.user.id;

  const [calendars, googleAccount] = await Promise.all([
    prisma.calendar.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        provider: true,
        isPrimary: true,
        lastSyncedAt: true,
        defaultReminderMinutes: true,
        icsTokenHash: true,
      },
    }),
    prisma.account.findFirst({
      where: { userId, provider: "google" },
    }),
  ]);

  const calendarOptions: CalendarOption[] = calendars.map((calendar) => ({
    id: calendar.id,
    name: calendar.name,
    provider: calendar.provider,
    isPrimary: calendar.isPrimary,
    lastSyncedAt: calendar.lastSyncedAt?.toISOString() ?? null,
    defaultReminderMinutes: calendar.defaultReminderMinutes,
  }));

  return (
    <CalendarSettingsClient
      calendars={calendarOptions}
      googleConnected={Boolean(googleAccount)}
      icsActive={calendars.some((calendar) => Boolean(calendar.icsTokenHash))}
    />
  );
}
