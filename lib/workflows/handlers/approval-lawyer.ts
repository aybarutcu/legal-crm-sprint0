import { ActionState, ActionType } from "@prisma/client";
import { z } from "zod";
import type { IActionHandler, WorkflowRuntimeContext } from "../types";
import { ActionHandlerError } from "../errors";

const configSchema = z.object({
  approverRole: z.enum(["LAWYER", "ADMIN"]).optional(),
  message: z.string().max(2000).optional(),
});

const completionSchema = z.object({
  approved: z.boolean(),
  comment: z.string().max(2000).optional(),
});

type ApprovalConfig = z.infer<typeof configSchema>;
type ApprovalData = {
  decision?: {
    approved: boolean;
    comment?: string;
    decidedAt: string;
    decidedBy?: string;
  };
};

export class ApprovalActionHandler implements IActionHandler<ApprovalConfig, ApprovalData> {
  readonly type = ActionType.APPROVAL_LAWYER;

  validateConfig(config: ApprovalConfig): void {
    configSchema.parse(config ?? {});
  }

  canStart(_ctx: WorkflowRuntimeContext<ApprovalConfig, ApprovalData>): boolean {
    return true;
  }

  async start(_ctx: WorkflowRuntimeContext<ApprovalConfig, ApprovalData>): Promise<ActionState> {
    // Approval actions transition to IN_PROGRESS when claimed.
    return ActionState.IN_PROGRESS;
  }

  async complete(
    ctx: WorkflowRuntimeContext<ApprovalConfig, ApprovalData>,
    payload?: unknown,
  ): Promise<ActionState> {
    const parsed = completionSchema.safeParse(payload ?? {});
    if (!parsed.success) {
      throw new ActionHandlerError("Invalid approval payload", "INVALID_PAYLOAD");
    }

    ctx.data.decision = {
      ...parsed.data,
      decidedAt: ctx.now.toISOString(),
      decidedBy: ctx.actor?.id,
    };

    return ActionState.COMPLETED;
  }

  async fail(
    _ctx: WorkflowRuntimeContext<ApprovalConfig, ApprovalData>,
    _reason: string,
  ): Promise<ActionState> {
    return ActionState.FAILED;
  }

  getNextStateOnEvent(
    _ctx: WorkflowRuntimeContext<ApprovalConfig, ApprovalData>,
    _event,
  ): ActionState | null {
    return null;
  }
}
