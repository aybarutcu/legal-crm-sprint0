import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { clientPasswordResetConfirmSchema } from "@/lib/validation/client";
import { hashResetToken } from "@/lib/security/reset-token";
import { hashPassword } from "@/lib/security/password";
import { recordAuditLog } from "@/lib/audit";

export const POST = withApiHandler(
  async (req) => {
    const payload = await req.json();
    const { token, password } = clientPasswordResetConfirmSchema.parse(payload);
    const hashed = hashResetToken(token);
    const now = new Date();

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: hashed,
        passwordResetExpiresAt: { gt: now },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Token geçersiz veya süresi dolmuş." }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
        activatedAt: user.activatedAt ?? now,
        isActive: true,
      },
    });

    await recordAuditLog({
      actorId: user.id,
      action: "client.password.reset",
      entityType: "user",
      entityId: user.id,
      metadata: {
        resetAt: now.toISOString(),
      },
    });

    return NextResponse.json({ success: true });
  },
  { requireAuth: false },
);
