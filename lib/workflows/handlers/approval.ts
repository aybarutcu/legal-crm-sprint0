import { ActionState, ActionType, Role, RoleScope } from "@prisma/client";
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
  readonly type = ActionType.APPROVAL;

  validateConfig(config: ApprovalConfig): void {
    configSchema.parse(config ?? {});
  }

  canStart(ctx: WorkflowRuntimeContext<ApprovalConfig, ApprovalData>): boolean {
    // This action requires lawyer approval - only lawyers and admins can perform it
    if (!ctx.actor) {
      return false;
    }

    // Admins can always perform any action
    if (ctx.actor.role === Role.ADMIN) {
      return true;
    }

    // For APPROVAL, the step's roleScope must be LAWYER
    // and the actor must be a lawyer
    if (ctx.step.roleScope === RoleScope.LAWYER && ctx.actor.role === Role.LAWYER) {
      return true;
    }

    return false;
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
      console.log("Payload validation failed:", parsed.error);
      throw new ActionHandlerError("Invalid approval payload", "INVALID_PAYLOAD");
    }

    ctx.data.decision = {
      approved: parsed.data.approved,
      comment: parsed.data.comment,
      decidedAt: ctx.now.toISOString(),
      decidedBy: ctx.actor?.id,
    };

    // Update workflow context
    ctx.updateContext({
      lastApproval: {
        approved: parsed.data.approved,
        approvedBy: ctx.actor?.id,
        approvedAt: ctx.now.toISOString(),
        comment: parsed.data.comment,
      },
      approvalCount: ((ctx.context.approvalCount as number) || 0) + 1,
      clientApproved: parsed.data.approved, // For schema validation
    });

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
    _event: import("../types").ActionEvent,
  ): ActionState | null {
    return null;
  }
}
