import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { calendarUpdateSchema } from "@/lib/validation/calendar";

type RouteParams = { params: { id: string } };

export const PATCH = withApiHandler(async (req, { params, session }) => {
  const user = session!.user!;
  const payload = calendarUpdateSchema.parse(await req.json());

  const calendar = await prisma.calendar.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      userId: true,
      provider: true,
    },
  });

  if (!calendar) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  if (calendar.userId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (payload.isPrimary) {
    await prisma.calendar.updateMany({
      where: {
        userId: calendar.userId,
        id: { not: calendar.id },
      },
      data: { isPrimary: false },
    });
  }

  const updated = await prisma.calendar.update({
    where: { id: calendar.id },
    data: {
      ...(payload.defaultReminderMinutes !== undefined
        ? { defaultReminderMinutes: payload.defaultReminderMinutes }
        : {}),
      ...(payload.isPrimary !== undefined ? { isPrimary: payload.isPrimary } : {}),
    },
    select: {
      id: true,
      name: true,
      provider: true,
      isPrimary: true,
      defaultReminderMinutes: true,
      lastSyncedAt: true,
    },
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    provider: updated.provider,
    isPrimary: updated.isPrimary,
    defaultReminderMinutes: updated.defaultReminderMinutes,
    lastSyncedAt: updated.lastSyncedAt?.toISOString() ?? null,
  });
});
