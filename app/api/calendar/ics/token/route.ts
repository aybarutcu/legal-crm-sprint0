import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildIcsUrl,
  createIcsToken,
  getPrimaryCalendar,
  hashToken,
} from "@/lib/events/ics";
import { withApiHandler } from "@/lib/api-handler";

export const POST = withApiHandler(async (_, { session }) => {
  const user = session!.user!;
  const calendar = await getPrimaryCalendar(user.id);
  const { token, hash } = createIcsToken();

  await prisma.calendar.update({
    where: { id: calendar.id },
    data: {
      icsTokenHash: hash,
      icsTokenCreatedAt: new Date(),
    },
  });

  return NextResponse.json({
    token,
    url: buildIcsUrl(token),
    calendarId: calendar.id,
  });
});

export const DELETE = withApiHandler(async (_, { session }) => {
  const user = session!.user!;
  await prisma.calendar.updateMany({
    where: { userId: user.id },
    data: {
      icsTokenHash: null,
      icsTokenCreatedAt: null,
    },
  });

  return new NextResponse(null, { status: 204 });
});
