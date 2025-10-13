import { randomUUID } from "crypto";
import { ActionState, ActionType } from "@prisma/client";
import { z } from "zod";
import type { IActionHandler, WorkflowRuntimeContext } from "../types";
import { ActionHandlerError } from "../errors";

const configSchema = z.object({
  documentId: z.string().min(1, "documentId is required"),
  provider: z.enum(["mock", "stripe", "docusign"]).default("mock").optional(),
});

type SignatureConfig = z.infer<typeof configSchema>;
type SignatureData = {
  sessionId?: string;
  provider?: string;
  completedAt?: string;
};

export class SignatureActionHandler implements IActionHandler<SignatureConfig, SignatureData> {
  readonly type = ActionType.SIGNATURE_CLIENT;

  validateConfig(config: SignatureConfig): void {
    configSchema.parse(config ?? {});
  }

  canStart(_ctx: WorkflowRuntimeContext<SignatureConfig, SignatureData>): boolean {
    return true;
  }

  async start(ctx: WorkflowRuntimeContext<SignatureConfig, SignatureData>): Promise<ActionState> {
    const config = configSchema.parse(ctx.config ?? {});
    ctx.data.sessionId = ctx.data.sessionId ?? `sig_${randomUUID()}`;
    ctx.data.provider = config.provider ?? "mock";
    return ActionState.IN_PROGRESS;
  }

  async complete(
    ctx: WorkflowRuntimeContext<SignatureConfig, SignatureData>,
    payload?: unknown,
  ): Promise<ActionState> {
    if (payload && typeof payload !== "object") {
      throw new ActionHandlerError("Signature completion payload must be an object", "INVALID_PAYLOAD");
    }
    ctx.data.completedAt = ctx.now.toISOString();
    return ActionState.COMPLETED;
  }

  async fail(
    _ctx: WorkflowRuntimeContext<SignatureConfig, SignatureData>,
    _reason: string,
  ): Promise<ActionState> {
    return ActionState.FAILED;
  }

  getNextStateOnEvent(
    ctx: WorkflowRuntimeContext<SignatureConfig, SignatureData>,
    event,
  ): ActionState | null {
    if (event.type === "SIGNATURE_COMPLETED") {
      ctx.data.completedAt = ctx.now.toISOString();
      return ActionState.COMPLETED;
    }
    if (event.type === "SIGNATURE_FAILED") {
      return ActionState.FAILED;
    }
    return null;
  }
}
