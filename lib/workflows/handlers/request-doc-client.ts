import { ActionState, ActionType } from "@prisma/client";
import { z } from "zod";
import type { IActionHandler, WorkflowRuntimeContext } from "../types";

const configSchema = z.object({
  requestText: z.string().min(1, "requestText is required"),
  acceptedTypes: z.array(z.string()).optional(),
});

type RequestDocConfig = z.infer<typeof configSchema>;
type RequestDocData = {
  status?: "OPEN" | "FULFILLED";
  uploadedDocumentId?: string;
};

export class RequestDocActionHandler implements IActionHandler<RequestDocConfig, RequestDocData> {
  readonly type = ActionType.REQUEST_DOC_CLIENT;

  validateConfig(config: RequestDocConfig): void {
    configSchema.parse(config ?? {});
  }

  canStart(_ctx: WorkflowRuntimeContext<RequestDocConfig, RequestDocData>): boolean {
    return true;
  }

  async start(ctx: WorkflowRuntimeContext<RequestDocConfig, RequestDocData>): Promise<ActionState> {
    ctx.data.status = "OPEN";
    return ActionState.IN_PROGRESS;
  }

  async complete(
    ctx: WorkflowRuntimeContext<RequestDocConfig, RequestDocData>,
    payload?: unknown,
  ): Promise<ActionState> {
    if (payload && typeof payload === "object" && payload !== null) {
      const docId = (payload as Record<string, unknown>).documentId;
      if (docId && typeof docId === "string") {
        ctx.data.uploadedDocumentId = docId;
      }
    }
    ctx.data.status = "FULFILLED";
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
    event,
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
