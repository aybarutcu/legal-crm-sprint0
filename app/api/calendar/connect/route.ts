import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";

export const DELETE = withApiHandler(async (_, { session }) => {
  const user = session!.user!;

  const googleCalendars = await prisma.calendar.findMany({
    where: {
      userId: user.id,
      provider: "GOOGLE",
    },
    select: { id: true },
  });

  if (googleCalendars.length > 0) {
    const calendarIds = googleCalendars.map((calendar) => calendar.id);
    await prisma.event.updateMany({
      where: { calendarId: { in: calendarIds } },
      data: { calendarId: null, externalCalId: null, externalEtag: null },
    });
    await prisma.calendar.deleteMany({
      where: { id: { in: calendarIds } },
    });
  }

  await prisma.account.deleteMany({
    where: { userId: user.id, provider: "google" },
  });

  return new NextResponse(null, { status: 204 });
});
