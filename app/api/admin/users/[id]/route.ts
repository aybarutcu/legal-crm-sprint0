import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { userUpdateSchema } from "@/lib/validation/user";
import { recordAuditLog } from "@/lib/audit";

type Params = {
  id: string;
};

export const PATCH = withApiHandler<Params>(async (req, { params, session }) => {
  const actor = session!.user!;
  if (![Role.ADMIN, Role.LAWYER].includes((actor.role ?? Role.LAWYER) as "ADMIN" | "LAWYER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await req.json();
  const update = userUpdateSchema.parse(payload);

  if (typeof update.role !== "undefined" && actor.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Role değişikliği için yetkiniz yok." }, { status: 403 });
  }

  const user = await prisma.user.findUnique({ where: { id: params!.id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.role === Role.ADMIN && actor.id === user.id && typeof update.isActive !== "undefined" && !update.isActive) {
    return NextResponse.json({ error: "Kendi hesabınızı pasif yapamazsınız." }, { status: 400 });
  }

  if (actor.role === Role.LAWYER && user.role === Role.ADMIN) {
    return NextResponse.json({ error: "Admin kullanıcılarda değişiklik yapılamaz." }, { status: 403 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      role: update.role ?? undefined,
      isActive: update.isActive ?? undefined,
    },
  });

  await recordAuditLog({
    actorId: actor.id,
    action: "user.update",
    entityType: "user",
    entityId: updated.id,
    metadata: {
      changes: update,
    },
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    isActive: updated.isActive,
    invitedAt: updated.invitedAt,
    activatedAt: updated.activatedAt,
  });
});
