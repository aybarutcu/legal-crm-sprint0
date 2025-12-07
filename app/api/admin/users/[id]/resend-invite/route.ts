import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { generateInviteToken } from "@/lib/security/invite-token";
import { sendClientInvitationEmail } from "@/lib/mail/client-invite";
import { recordAuditLog } from "@/lib/audit";

type Params = {
  id: string;
};

function buildPortalInviteUrl(token: string) {
  const base =
    process.env.NEXT_PUBLIC_PORTAL_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000";
  const normalized = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalized}/portal/activate?token=${encodeURIComponent(token)}`;
}

export const POST = withApiHandler<Params>(async (_req, { params, session }) => {
  const actor = session!.user!;
  if (![Role.ADMIN, Role.LAWYER].includes((actor.role ?? Role.LAWYER) as "ADMIN" | "LAWYER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: params!.id },
    include: {
      clientProfile: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  if (!user || user.role !== Role.CLIENT) {
    return NextResponse.json({ error: "Client user not found" }, { status: 404 });
  }

  const { token, hash } = generateInviteToken();
  const now = new Date();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      invitationToken: hash,
      invitedAt: now,
      isActive: user.isActive,
    },
  });

  const inviteUrl = buildPortalInviteUrl(token);
  await sendClientInvitationEmail({
    to: user.email,
    inviteUrl,
    inviterName: actor.name ?? actor.email,
    clientName: user.clientProfile?.firstName ?? user.name ?? user.email,
  });

  await recordAuditLog({
    actorId: actor.id,
    action: "client.invite.resend",
    entityType: "user",
    entityId: user.id,
    metadata: {
      invitedAt: now.toISOString(),
    },
  });

  return NextResponse.json({
    success: true,
    invitedAt: now.toISOString(),
  });
});
