import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { createSignedDownloadUrl } from "@/lib/storage";
import { assertMatterAccess, assertContactAccess } from "@/lib/authorization";
import { checkDocumentAccess } from "@/lib/documents/access-control";

const DOWNLOAD_URL_TTL = parseInt(
  process.env.SIGNED_URL_TTL_SECONDS ?? "300",
  10,
);

type Params = { id: string };

export const GET = withApiHandler<Params>(async (_req, { params, session }) => {
  const id = params!.id;
  const user = session!.user!;

  if (!id) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const document = await prisma.document.findUnique({
    where: { id },
    select: { 
      id: true,
      storageKey: true, 
      mime: true,
      matterId: true,
      contactId: true,
      uploaderId: true,
      accessScope: true,
      accessMetadata: true,
      workflowStepId: true,
      workflowStep: {
        select: {
          instance: {
            select: {
              matterId: true,
              contactId: true,
            },
          },
        },
      },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  // Check granular document access control
  const accessCheck = await checkDocumentAccess(
    {
      id: document.id,
      uploaderId: document.uploaderId,
      accessScope: document.accessScope,
      accessMetadata: document.accessMetadata as Record<string, unknown> | null,
      matterId: document.matterId,
      contactId: document.contactId,
    },
    { userId: user.id, userRole: user.role }
  );

  if (!accessCheck.hasAccess) {
    return NextResponse.json(
      { error: "Access denied to download this document", reason: accessCheck.reason },
      { status: 403 }
    );
  }

  // Legacy matter/contact access control (for backward compatibility)
  if (document.matterId) {
    await assertMatterAccess(user, document.matterId);
  } else if (document.contactId) {
    await assertContactAccess(user, document.contactId);
  } else if (document.workflowStep?.instance.matterId) {
    // Document linked via workflow step
    await assertMatterAccess(user, document.workflowStep.instance.matterId);
  } else if (document.workflowStep?.instance.contactId) {
    await assertContactAccess(user, document.workflowStep.instance.contactId);
  }

  const getUrl = await createSignedDownloadUrl({
    key: document.storageKey,
    expiresIn: DOWNLOAD_URL_TTL,
  });

  return NextResponse.json({
    getUrl,
    mime: document.mime,
    expiresAt: new Date(Date.now() + DOWNLOAD_URL_TTL * 1000).toISOString(),
  });
});
