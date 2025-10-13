import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { clientActivationSchema } from "@/lib/validation/client";
import { hashInviteToken } from "@/lib/security/invite-token";
import { hashPassword } from "@/lib/security/password";
import { recordAuditLog } from "@/lib/audit";

const INVITE_TTL_HOURS = Number.parseInt(process.env.CLIENT_INVITE_TTL_HOURS ?? "24", 10);

export const POST = withApiHandler(
  async (req) => {
    const payload = await req.json();
    const { token, password, firstName, lastName } = clientActivationSchema.parse(payload);

    const hashedToken = hashInviteToken(token);
    const now = new Date();
    const expirationCutoff = new Date(now.getTime() - INVITE_TTL_HOURS * 60 * 60 * 1000);

    const user = await prisma.user.findFirst({
      where: {
        invitationToken: hashedToken,
        role: Role.CLIENT,
      },
      include: {
        clientProfile: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Token geçersiz veya kullanıcı bulunamadı." }, { status: 400 });
    }

    if (user.invitedAt && user.invitedAt < expirationCutoff) {
      return NextResponse.json({ error: "Davet linkinin süresi dolmuş." }, { status: 410 });
    }

    const passwordHash = await hashPassword(password);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          invitationToken: null,
          passwordResetToken: null,
          passwordResetExpiresAt: null,
          isActive: true,
          activatedAt: now,
        },
      });

      if (user.clientProfile) {
        await tx.contact.update({
          where: { id: user.clientProfile.id },
          data: {
            firstName: firstName?.trim() ? firstName.trim() : user.clientProfile.firstName,
            lastName: lastName?.trim() ? lastName.trim() : user.clientProfile.lastName,
          },
        });
      }
    });

    await recordAuditLog({
      actorId: user.id,
      action: "client.activate",
      entityType: "user",
      entityId: user.id,
      metadata: {
        invitedAt: user.invitedAt,
        activatedAt: now.toISOString(),
      },
    });

    return NextResponse.json({ success: true });
  },
  { requireAuth: false },
);
