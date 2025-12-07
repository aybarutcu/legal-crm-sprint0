import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { recordAuditLog } from "@/lib/audit";
import {
  assertCanModifyEvent,
  eventDefaultInclude,
  serializeEvent,
} from "@/lib/events/service";
import { enqueueEventSync } from "@/lib/events/sync";
import { eventSyncSchema } from "@/lib/validation/event";

type RouteParams = { id: string };

export const POST = withApiHandler<RouteParams>(
  async (req, { params, session }) => {
    const user = session!.user!;
    const payload = eventSyncSchema.parse(
      await req
        .json()
        .catch(() => ({})),
    );

    const event = await prisma.event.findUnique({
      where: { id: params!.id },
      include: eventDefaultInclude,
    });

    if (!event) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    assertCanModifyEvent({
      event,
      userId: user.id,
      role: user.role,
    });

    const result = await enqueueEventSync({
      event,
      actorId: user.id,
      force: payload.force ?? false,
    });

    await recordAuditLog({
      actorId: user.id,
      action: "event.sync",
      entityType: "event",
      entityId: event.id,
      metadata: {
        force: result.force,
        calendarId: result.calendarId,
      },
    });

    return NextResponse.json(
      {
        status: result.status,
        force: result.force,
        calendarId: result.calendarId,
        event: serializeEvent(event),
      },
      { status: 202 },
    );
  },
);
