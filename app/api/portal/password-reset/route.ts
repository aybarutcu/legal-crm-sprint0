import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { clientPasswordResetRequestSchema } from "@/lib/validation/client";
import { generateResetToken } from "@/lib/security/reset-token";
import { sendClientPasswordResetEmail } from "@/lib/mail/client-password-reset";

const RESET_TTL_HOURS = Number.parseInt(process.env.CLIENT_RESET_TTL_HOURS ?? "24", 10);

function buildResetUrl(token: string) {
  const base =
    process.env.NEXT_PUBLIC_PORTAL_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000";
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalizedBase}/portal/password-reset?token=${encodeURIComponent(token)}`;
}

export const POST = withApiHandler(
  async (req) => {
    const payload = await req.json();
    const { email } = clientPasswordResetRequestSchema.parse(payload);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RESET_TTL_HOURS * 60 * 60 * 1000);

    const user = await prisma.user.findFirst({
      where: { email, role: Role.CLIENT },
      include: { clientProfile: true },
    });

    if (!user) {
      return NextResponse.json({ success: true }, { status: 202 });
    }

    const { token, hash } = generateResetToken();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hash,
        passwordResetExpiresAt: expiresAt,
      },
    });

    const resetUrl = buildResetUrl(token);
    await sendClientPasswordResetEmail({
      to: user.email,
      resetUrl,
      clientName: user.clientProfile?.firstName ?? user.name,
    });

    return NextResponse.json({ success: true }, { status: 202 });
  },
  { requireAuth: false },
);
