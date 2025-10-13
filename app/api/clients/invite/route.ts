import { NextResponse } from "next/server";
import { ContactStatus, ContactType, Role, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { recordAuditLog } from "@/lib/audit";
import { clientInviteSchema } from "@/lib/validation/client";
import { generateInviteToken } from "@/lib/security/invite-token";
import { sendClientInvitationEmail } from "@/lib/mail/client-invite";

const INVITE_TTL_HOURS = Number.parseInt(process.env.CLIENT_INVITE_TTL_HOURS ?? "24", 10);

function parseName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) {
    return { firstName: "Müşteri", lastName: "" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  const firstName = parts.shift()!;
  const lastName = parts.join(" ");
  return { firstName, lastName };
}

function buildPortalInviteUrl(token: string) {
  const base =
    process.env.NEXT_PUBLIC_PORTAL_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "http://localhost:3000";
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalizedBase}/portal/activate?token=${encodeURIComponent(token)}`;
}

export const POST = withApiHandler(async (req, { session }) => {
  const inviter = session!.user!;
  if (![Role.ADMIN, Role.LAWYER].includes(inviter.role ?? Role.LAWYER)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await req.json();
  const { email, name } = clientInviteSchema.parse(payload);
  const { firstName, lastName } = parseName(name);

  const { token, hash } = generateInviteToken();
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { email },
      include: { clientProfile: true },
    });

    if (existingUser && existingUser.role !== Role.CLIENT) {
      return { error: "Email already belongs to internal user" } as const;
    }

    const user =
      existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              name,
              invitationToken: hash,
              invitedAt: now,
              invitedById: inviter.id,
              isActive: existingUser.isActive,
            },
          })
        : await tx.user.create({
            data: {
              email,
              name,
              role: Role.CLIENT,
              status: UserStatus.ACTIVE,
              invitationToken: hash,
              invitedAt: now,
              invitedById: inviter.id,
              isActive: false,
            },
          });

    let contact =
      existingUser?.clientProfile ??
      (await tx.contact.findFirst({
        where: { email },
      }));

    if (contact && contact.userId && contact.userId !== user.id) {
      return { error: "Contact already linked to another user" } as const;
    }

    if (contact) {
      contact = await tx.contact.update({
        where: { id: contact.id },
        data: {
          firstName: contact.firstName || firstName,
          lastName: contact.lastName || lastName || "Client",
          type: contact.type === ContactType.CLIENT ? contact.type : ContactType.CLIENT,
          status: ContactStatus.ACTIVE,
          userId: user.id,
        },
      });
    } else {
      contact = await tx.contact.create({
        data: {
          firstName,
          lastName: lastName || "Client",
          email,
          type: ContactType.CLIENT,
          status: ContactStatus.ACTIVE,
          ownerId: inviter.id,
          userId: user.id,
        },
      });
    }

    return { user, contact } as const;
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  const inviteUrl = buildPortalInviteUrl(token);
  await recordAuditLog({
    actorId: inviter.id,
    action: "client.invite",
    entityType: "user",
    entityId: result.user.id,
    metadata: {
      email,
      contactId: result.contact.id,
    },
  });
  await sendClientInvitationEmail({
    to: email,
    inviteUrl,
    inviterName: inviter.name ?? inviter.email,
    clientName: result.contact.firstName,
  });

  return NextResponse.json(
    {
      id: result.user.id,
      email: result.user.email,
      invitedAt: now.toISOString(),
      inviteExpiresAt: new Date(now.getTime() + INVITE_TTL_HOURS * 60 * 60 * 1000).toISOString(),
    },
    { status: 201 },
  );
});
