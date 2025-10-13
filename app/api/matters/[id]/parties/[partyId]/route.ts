import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";
import { withApiHandler } from "@/lib/api-handler";
import { assertCanModifyResource } from "@/lib/authorization";

type MatterPartyParams = {
  id: string;
  partyId: string;
};

export const DELETE = withApiHandler<MatterPartyParams>(async (_req, { params, session }) => {
  const party = await prisma.matterContact.findUnique({
    where: { id: params!.partyId },
    include: { matter: { select: { id: true, ownerId: true } } },
  });

  if (!party || party.matter.id !== params!.id) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  assertCanModifyResource({
    userRole: session!.user!.role,
    userId: session!.user!.id,
    resourceOwnerId: party.matter.ownerId,
  });

  await prisma.matterContact.delete({ where: { id: params!.partyId } });

  await recordAuditLog({
    actorId: session!.user!.id,
    action: "matter.party.delete",
    entityType: "matter",
    entityId: params!.id,
    metadata: { partyId: params!.partyId, contactId: party.contactId },
  });

  return new NextResponse(null, { status: 204 });
});
