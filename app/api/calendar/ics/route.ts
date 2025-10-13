import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateIcs, hashToken, fetchEventsForUser } from "@/lib/events/ics";

export const GET = async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "token missing" }, { status: 400 });
  }

  const hashed = hashToken(token);
  const calendar = await prisma.calendar.findFirst({
    where: { icsTokenHash: hashed },
    select: { id: true, userId: true },
  });

  if (!calendar) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: calendar.userId },
    select: { role: true },
  });

  const events = await fetchEventsForUser(calendar.userId, user?.role);
  const ics = generateIcs(events);

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
};
