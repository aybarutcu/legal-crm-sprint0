import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { matterPartyCreateSchema } from "@/lib/validation/matter";
import { recordAuditLog } from "@/lib/audit";
import { withApiHandler } from "@/lib/api-handler";
import { assertMatterAccess } from "@/lib/authorization";

type MatterPartyParams = {
  id: string;
};

export const POST = withApiHandler<MatterPartyParams>(async (req, { params, session }) => {
  const payload = await req.json();
  const parsed = matterPartyCreateSchema.parse(payload);

  await assertMatterAccess(session!.user!, params!.id);

  const created = await prisma.matterContact.create({
    data: {
      matterId: params!.id,
      contactId: parsed.contactId,
      role: parsed.role,
    },
    include: {
      contact: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  await recordAuditLog({
    actorId: session!.user!.id,
    action: "matter.party.create",
    entityType: "matter",
    entityId: params!.id,
    metadata: { contactId: parsed.contactId, role: parsed.role },
  });

  return NextResponse.json(created, { status: 201 });
});