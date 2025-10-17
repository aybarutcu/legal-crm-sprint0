import { ActionState, ActionType, Role } from "@prisma/client";
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

  canStart(ctx: WorkflowRuntimeContext<ChecklistConfig, ChecklistData>): boolean {
    // Checklist can be performed by anyone assigned based on roleScope
    // The ensureActorCanPerform() in the service layer already validates this
    // Here we just check that we have an actor
    if (!ctx.actor) {
      return false;
    }

    // Admins can always perform checklists
    if (ctx.actor.role === Role.ADMIN) {
      return true;
    }

    // For other roles, rely on the roleScope validation done in ensureActorCanPerform
    // which checks if the actor is in the eligible list for the step's roleScope
    return true;
  }

  async start(_ctx: WorkflowRuntimeContext<ChecklistConfig, ChecklistData>): Promise<ActionState> {
    return ActionState.IN_PROGRESS;
  }

  async complete(
    ctx: WorkflowRuntimeContext<ChecklistConfig, ChecklistData>,
    payload?: unknown,
  ): Promise<ActionState> {
    let completedItems: string[];
    if (payload) {
      const parsed = completePayloadSchema.safeParse(payload);
      if (!parsed.success) {
        throw new ActionHandlerError("Invalid checklist completion payload", "INVALID_PAYLOAD");
      }
      completedItems = parsed.data.completedItems ?? ctx.config.items;
    } else {
      completedItems = ctx.config.items;
    }
    ctx.data.completedItems = completedItems;

    // Update workflow context
    ctx.updateContext({
      checklistCompleted: true,
      totalItemsCompleted: completedItems.length,
      completedBy: ctx.actor?.id,
      completedAt: ctx.now.toISOString(),
    });

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
