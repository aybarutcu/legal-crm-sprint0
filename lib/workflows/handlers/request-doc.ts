import { ActionState, ActionType, Role, RoleScope } from "@prisma/client";
import { z } from "zod";
import type { IActionHandler, WorkflowRuntimeContext } from "../types";
import { prisma } from "@/lib/prisma";

const configSchema = z.object({
  requestText: z.string().min(1, "requestText is required"),
  documentNames: z.array(z.string()).min(1, "At least one document name is required"),
  acceptedFileTypes: z.array(z.string()).optional(),
});

type RequestDocConfig = z.infer<typeof configSchema>;

// Track which documents have been uploaded
type DocumentUploadStatus = {
  requestId: string; // Unique ID for this document request
  documentName: string; // e.g., "Copy of ID"
  uploaded: boolean;
  documentId?: string; // ID of the uploaded document (latest version)
  uploadedAt?: string; // ISO timestamp
  version?: number; // Current version number
};

type RequestDocData = {
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  documentsStatus: DocumentUploadStatus[]; // Track each requested document
  allDocumentsUploaded?: boolean;
};

export class RequestDocActionHandler
  implements IActionHandler<RequestDocConfig, RequestDocData>
{
  readonly type = ActionType.REQUEST_DOC;

  validateConfig(config: RequestDocConfig): void {
    configSchema.parse(config ?? {});
  }

  canStart(ctx: WorkflowRuntimeContext<RequestDocConfig, RequestDocData>): boolean {
    // Document requests can be initiated by lawyers/paralegals but completed by clients
    if (!ctx.actor) {
      return false;
    }

    // Admins can always perform document requests
    if (ctx.actor.role === Role.ADMIN) {
      return true;
    }

    // Clients complete document upload requests
    if (ctx.step.roleScope === RoleScope.CLIENT && ctx.actor.role === Role.CLIENT) {
      return true;
    }

    // Lawyers and paralegals cannot complete client document uploads
    // (they can only request them)
    return false;
  }

  async start(ctx: WorkflowRuntimeContext<RequestDocConfig, RequestDocData>): Promise<ActionState> {
    // Initialize tracking for each requested document with unique IDs
    const documentNames = ctx.config.documentNames || [];
    ctx.data.status = "IN_PROGRESS";
    
    // Check if there are existing documents in the matter with the same displayName
    const matterId = ctx.step.instance.matterId;
    const contactId = ctx.step.instance.contactId;
    
    const documentsStatus: DocumentUploadStatus[] = [];
    
    for (const name of documentNames) {
      const requestId = `${ctx.step.id}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      
      // Look for existing document with same displayName in the matter/contact
      // This includes documents from previous workflows (orphaned or active)
      let existingDoc = null;
      if (matterId) {
        existingDoc = await prisma.document.findFirst({
          where: {
            matterId,
            displayName: name,
            deletedAt: null,
          },
          orderBy: { version: 'desc' },
          select: { id: true, version: true, createdAt: true },
        });
      } else if (contactId) {
        existingDoc = await prisma.document.findFirst({
          where: {
            contactId,
            displayName: name,
            deletedAt: null,
          },
          orderBy: { version: 'desc' },
          select: { id: true, version: true, createdAt: true },
        });
      }
      
      // If document exists, mark as uploaded with existing document info
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
        // No existing document, needs to be uploaded
        documentsStatus.push({
          requestId,
          documentName: name,
          uploaded: false,
          version: 0,
        });
      }
    }
    
    ctx.data.documentsStatus = documentsStatus;
    ctx.data.allDocumentsUploaded = documentsStatus.every(d => d.uploaded);

    return ActionState.IN_PROGRESS;
  }

  async complete(
    ctx: WorkflowRuntimeContext<RequestDocConfig, RequestDocData>,
    _payload?: unknown,
  ): Promise<ActionState> {
    // Check if all requested documents have been uploaded
    // Documents are linked via workflowStepId and tagged with document names
    const allUploaded = ctx.data.documentsStatus?.every((doc) => doc.uploaded) ?? false;
    
    if (!allUploaded) {
      // Not all documents uploaded yet - can't complete
      throw new Error("Not all requested documents have been uploaded");
    }

    ctx.data.status = "COMPLETED";
    ctx.data.allDocumentsUploaded = true;

    // Update workflow context
    ctx.updateContext({
      documentsRequested: true,
      requestedDocumentNames: ctx.config.documentNames,
      allDocumentsUploaded: true,
      completedAt: ctx.now.toISOString(),
    });

    return ActionState.COMPLETED;
  }

  /**
   * Mark a specific document as uploaded.
   * This is called when a document with matching requestId is created.
   */
  markDocumentUploaded(
    ctx: WorkflowRuntimeContext<RequestDocConfig, RequestDocData>,
    requestId: string,
    documentId: string,
  ): boolean {
    if (!ctx.data.documentsStatus) {
      return false;
    }

    // Find the document status entry by requestId
    const docStatus = ctx.data.documentsStatus.find((d) => d.requestId === requestId);
    if (!docStatus) {
      return false;
    }

    // Increment version and mark as uploaded
    docStatus.uploaded = true;
    docStatus.documentId = documentId;
    docStatus.uploadedAt = ctx.now.toISOString();
    docStatus.version = (docStatus.version || 0) + 1;

    // Check if all documents are now uploaded
    const allUploaded = ctx.data.documentsStatus.every((d) => d.uploaded);
    ctx.data.allDocumentsUploaded = allUploaded;

    return allUploaded;
  }

  async fail(
    ctx: WorkflowRuntimeContext<RequestDocConfig, RequestDocData>,
    reason: string,
  ): Promise<ActionState> {
    ctx.data.status = "COMPLETED";
    ctx.updateContext({
      documentRequestFailed: true,
      failureReason: reason,
    });
    return ActionState.FAILED;
  }

  getNextStateOnEvent(
    ctx: WorkflowRuntimeContext<RequestDocConfig, RequestDocData>,
    event: import("../types").ActionEvent,
  ): ActionState | null {
    if (event.type === "DOCUMENT_UPLOADED") {
      // Extract requestId and documentId from event payload
      if (typeof event.payload === "object" && event.payload !== null) {
        const { requestId, documentId } = event.payload as {
          requestId?: string;
          documentId?: string;
        };

        if (requestId && documentId) {
          // Mark the document as uploaded
          const allUploaded = this.markDocumentUploaded(ctx, requestId, documentId);

          // If all documents are uploaded, automatically complete the step
          if (allUploaded) {
            ctx.data.status = "COMPLETED";
            ctx.updateContext({
              allDocumentsUploaded: true,
              autoCompletedAt: ctx.now.toISOString(),
            });
            return ActionState.COMPLETED;
          }
        }
      }
    }
    return null;
  }
}
