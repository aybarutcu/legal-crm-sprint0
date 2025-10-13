import { ActionState, ActionType } from "@prisma/client";
import { z } from "zod";
import type { IActionHandler, WorkflowRuntimeContext } from "../types";
import { ActionHandlerError } from "../errors";

const configSchema = z.object({
  items: z.array(z.string().min(1)).optional().default([]),
});

const completePayloadSchema = z.object({
  completedItems: z.array(z.string()).optional(),
});

type ChecklistConfig = z.infer<typeof configSchema>;
type ChecklistData = {
  completedItems?: string[];
};

export class ChecklistActionHandler implements IActionHandler<ChecklistConfig, ChecklistData> {
  readonly type = ActionType.CHECKLIST;

  validateConfig(config: ChecklistConfig): void {
    configSchema.parse(config ?? {});
  }

  canStart(_ctx: WorkflowRuntimeContext<ChecklistConfig, ChecklistData>): boolean {
    return true;
  }

  async start(_ctx: WorkflowRuntimeContext<ChecklistConfig, ChecklistData>): Promise<ActionState> {
    return ActionState.IN_PROGRESS;
  }

  async complete(
    ctx: WorkflowRuntimeContext<ChecklistConfig, ChecklistData>,
    payload?: unknown,
  ): Promise<ActionState> {
    if (payload) {
      const parsed = completePayloadSchema.safeParse(payload);
      if (!parsed.success) {
        throw new ActionHandlerError("Invalid checklist completion payload", "INVALID_PAYLOAD");
      }
      ctx.data.completedItems = parsed.data.completedItems ?? ctx.config.items;
    } else {
      ctx.data.completedItems = ctx.config.items;
    }
    return ActionState.COMPLETED;
  }

  async fail(
    _ctx: WorkflowRuntimeContext<ChecklistConfig, ChecklistData>,
    _reason: string,
  ): Promise<ActionState> {
    return ActionState.FAILED;
  }

  getNextStateOnEvent(): ActionState | null {
    return null;
  }
}
