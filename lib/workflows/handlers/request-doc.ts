import { ActionState, ActionType, Role, RoleScope } from "@prisma/client";
import { z } from "zod";
import type { IActionHandler, WorkflowRuntimeContext } from "../types";

const configSchema = z.object({
  requestText: z.string().min(1, "requestText is required"),
  documentNames: z.array(z.string()).min(1, "At least one document name is required"),
  acceptedFileTypes: z.array(z.string()).optional(),
});

type RequestDocConfig = z.infer<typeof configSchema>;

// Track which documents have been uploaded
type DocumentUploadStatus = {
  documentName: string; // e.g., "Copy of ID"
  uploaded: boolean;
  documentId?: string; // ID of the uploaded document
  uploadedAt?: string; // ISO timestamp
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
    // Initialize tracking for each requested document
    const documentNames = ctx.config.documentNames || [];
    ctx.data.status = "IN_PROGRESS";
    ctx.data.documentsStatus = documentNames.map((name) => ({
      documentName: name,
      uploaded: false,
    }));
    ctx.data.allDocumentsUploaded = false;

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
   * This is called when a document with matching tag and workflowStepId is created.
   */
  markDocumentUploaded(
    ctx: WorkflowRuntimeContext<RequestDocConfig, RequestDocData>,
    documentName: string,
    documentId: string,
  ): boolean {
    if (!ctx.data.documentsStatus) {
      return false;
    }

    // Find the document status entry
    const docStatus = ctx.data.documentsStatus.find((d) => d.documentName === documentName);
    if (!docStatus) {
      return false;
    }

    // Mark as uploaded
    docStatus.uploaded = true;
    docStatus.documentId = documentId;
    docStatus.uploadedAt = ctx.now.toISOString();

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
      // Extract documentName and documentId from event payload
      if (typeof event.payload === "object" && event.payload !== null) {
        const { documentName, documentId } = event.payload as {
          documentName?: string;
          documentId?: string;
        };

        if (documentName && documentId) {
          // Mark the document as uploaded
          const allUploaded = this.markDocumentUploaded(ctx, documentName, documentId);

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
