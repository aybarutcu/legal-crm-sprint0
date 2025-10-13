import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { recordAuditLog } from "@/lib/audit";
import { performUserCalendarSync } from "@/lib/events/sync";
import { calendarSyncSchema } from "@/lib/validation/calendar";

export const POST = withApiHandler(async (req, { session }) => {
  const user = session!.user!;
  const payload = calendarSyncSchema.parse(
    await req
      .json()
      .catch(() => ({})),
  );

  const result = await performUserCalendarSync({
    actorId: user.id,
    actorRole: user.role,
    calendarId: payload.calendarId ?? null,
    forceFull: payload.forceFull ?? false,
  });

  await recordAuditLog({
    actorId: user.id,
    action: "calendar.sync",
    entityType: "calendar",
    entityId: payload.calendarId ?? result.calendarIds[0] ?? "self",
    metadata: {
      calendarIds: result.calendarIds,
      forceFull: result.forceFull,
    },
  });

  const statusCode = result.status === "queued" ? 202 : 200;

  return NextResponse.json(result, { status: statusCode });
});
