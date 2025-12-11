import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/workflows/steps/[id]/document-status
 * 
 * Dynamically check document upload status for a REQUEST_DOC workflow step.
 * This ensures the UI always shows current state, even if documents were uploaded
 * to other workflows or after this workflow was created.
 */
export const GET = withApiHandler<{ id: string }>(
  async (req, { params, session }) => {
    const { id: stepId } = await params!;
    const user = session!.user;

    // Get the workflow step
    const step = await prisma.workflowInstanceStep.findUnique({
      where: { id: stepId },
      include: {
        instance: {
          select: {
            matterId: true,
            contactId: true,
          },
        },
      },
    });

    if (!step) {
      return NextResponse.json(
        { error: "Workflow step not found" },
        { status: 404 }
      );
    }

    if (step.actionType !== "REQUEST_DOC") {
      return NextResponse.json(
        { error: "This endpoint only works for REQUEST_DOC steps" },
        { status: 400 }
      );
    }

    // Get the config from actionData
    const actionData = step.actionData as any;
    const config = actionData?.config || {};
    const documentNames = (config.documentNames || []) as string[];

    // Check each requested document against current database state
    const documentsStatus = [];

    for (const name of documentNames) {
      const requestId = `${stepId}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

      // Find the latest version of this document in the matter/contact
      let existingDoc = null;
      
      if (step.instance.matterId) {
        existingDoc = await prisma.document.findFirst({
          where: {
            matterId: step.instance.matterId,
            displayName: name,
            deletedAt: null,
          },
          orderBy: { version: 'desc' },
          select: {
            id: true,
            version: true,
            createdAt: true,
          },
        });
      } else if (step.instance.contactId) {
        existingDoc = await prisma.document.findFirst({
          where: {
            contactId: step.instance.contactId,
            displayName: name,
            deletedAt: null,
          },
          orderBy: { version: 'desc' },
          select: {
            id: true,
            version: true,
            createdAt: true,
          },
        });
      }

      if (existingDoc) {
        documentsStatus.push({
          requestId,
          documentName: name,
          uploaded: true,
          documentId: existingDoc.id,
          uploadedAt: existingDoc.createdAt.toISOString(),
          version: existingDoc.version,
        });
      } else {
        documentsStatus.push({
          requestId,
          documentName: name,
          uploaded: false,
          version: 0,
        });
      }
    }

    const allDocumentsUploaded = documentsStatus.every(d => d.uploaded);

    return NextResponse.json({
      stepId,
      documentsStatus,
      allDocumentsUploaded,
      actionState: step.actionState,
    });
  },
  { requireAuth: true }
);
