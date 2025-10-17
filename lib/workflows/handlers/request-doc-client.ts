import { ActionState, ActionType, Role, RoleScope } from "@prisma/client";
import { z } from "zod";
import type { IActionHandler, WorkflowRuntimeContext } from "../types";
import { ActionHandlerError } from "../errors";

const configSchema = z.object({
  requestText: z.string().min(1, "requestText is required"),
  acceptedFileTypes: z.array(z.string()).optional(),
});

type RequestDocConfig = z.infer<typeof configSchema>;
type RequestDocData = {
  uploadedDocumentId?: string;
  status?: "PENDING" | "FULFILLED" | "OPEN";
};

export class RequestDocActionHandler implements IActionHandler<RequestDocConfig, RequestDocData> {
  readonly type = ActionType.REQUEST_DOC_CLIENT;

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
    ctx.data.status = "OPEN";
    return ActionState.IN_PROGRESS;
  }

  async complete(
    ctx: WorkflowRuntimeContext<RequestDocConfig, RequestDocData>,
    payload?: unknown,
  ): Promise<ActionState> {
    let documentId: string | undefined;
    if (payload && typeof payload === "object" && payload !== null) {
      const docId = (payload as Record<string, unknown>).documentId;
      if (docId && typeof docId === "string") {
        ctx.data.uploadedDocumentId = docId;
        documentId = docId;
      }
    }
    ctx.data.status = "FULFILLED";

    // Update workflow context
    ctx.updateContext({
      documentsRequested: true,
      documentUploadedId: documentId,
      uploadedBy: ctx.actor?.id,
      uploadedAt: ctx.now.toISOString(),
      documentCount: documentId ? ((ctx.context.documentCount as number) || 0) + 1 : ctx.context.documentCount,
    });

    return ActionState.COMPLETED;
  }

  async fail(
    _ctx: WorkflowRuntimeContext<RequestDocConfig, RequestDocData>,
    _reason: string,
  ): Promise<ActionState> {
    return ActionState.FAILED;
  }

  getNextStateOnEvent(
    ctx: WorkflowRuntimeContext<RequestDocConfig, RequestDocData>,
    event: import("../types").ActionEvent,
  ): ActionState | null {
    if (event.type === "DOCUMENT_UPLOADED") {
      if (typeof event.payload === "object" && event.payload !== null) {
        const docId = (event.payload as Record<string, unknown>).documentId;
        if (docId && typeof docId === "string") {
          ctx.data.uploadedDocumentId = docId;
        }
      }
      ctx.data.status = "FULFILLED";
      return ActionState.COMPLETED;
    }
    return null;
  }
}
