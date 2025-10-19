import { ActionState, ActionType, Role } from "@prisma/client";
import { z } from "zod";
import type { IActionHandler, WorkflowRuntimeContext } from "../types";
import { ActionHandlerError } from "../errors";

const configSchema = z.object({
  description: z.string().optional(),
  requiresEvidence: z.boolean().optional().default(false),
  estimatedMinutes: z.number().int().positive().optional(),
});

const completePayloadSchema = z.object({
  notes: z.string().optional(),
  evidence: z.array(z.string()).optional(), // Document IDs
});

type TaskConfig = z.infer<typeof configSchema>;
type TaskData = {
  completedBy?: string;
  completedAt?: string;
  notes?: string;
  evidence?: string[];
};

/**
 * TaskActionHandler - Handles simple task completion
 * 
 * This is the base task type for the workflow system, replacing the legacy
 * standalone Tasks table. Any work item can be modeled as a TASK workflow step.
 * 
 * Use this for:
 * - Simple to-dos (e.g., "Call client", "File document")
 * - Single-step actions without complex logic
 * - Tasks that need to be tracked within a workflow
 * 
 * For multi-item tasks with sub-items, use CHECKLIST instead.
 */
export class TaskActionHandler implements IActionHandler<TaskConfig, TaskData> {
  readonly type = ActionType.TASK;

  validateConfig(config: TaskConfig): void {
    configSchema.parse(config ?? {});
  }

  canStart(ctx: WorkflowRuntimeContext<TaskConfig, TaskData>): boolean {
    // Task can be performed by anyone assigned based on roleScope
    // The ensureActorCanPerform() in the service layer already validates this
    if (!ctx.actor) {
      return false;
    }

    // Admins can always perform tasks
    if (ctx.actor.role === Role.ADMIN) {
      return true;
    }

    // For other roles, rely on the roleScope validation done in ensureActorCanPerform
    // which checks if the actor is in the eligible list for the step's roleScope
    return true;
  }

  async start(_ctx: WorkflowRuntimeContext<TaskConfig, TaskData>): Promise<ActionState> {
    // Task is now in progress
    return ActionState.IN_PROGRESS;
  }

  async complete(
    ctx: WorkflowRuntimeContext<TaskConfig, TaskData>,
    payload?: unknown,
  ): Promise<ActionState> {
    // Validate payload if provided
    let notes: string | undefined;
    let evidence: string[] | undefined;

    if (payload) {
      const parsed = completePayloadSchema.safeParse(payload);
      if (!parsed.success) {
        throw new ActionHandlerError("Invalid task completion payload", "INVALID_PAYLOAD");
      }
      notes = parsed.data.notes;
      evidence = parsed.data.evidence;
    }

    // Check if evidence is required
    if (ctx.config.requiresEvidence && (!evidence || evidence.length === 0)) {
      throw new ActionHandlerError(
        "This task requires evidence (documents) to be provided",
        "EVIDENCE_REQUIRED"
      );
    }

    // Store completion data
    ctx.data.completedBy = ctx.actor?.id;
    ctx.data.completedAt = ctx.now.toISOString();
    if (notes) ctx.data.notes = notes;
    if (evidence) ctx.data.evidence = evidence;

    // Update workflow context
    ctx.updateContext({
      taskCompleted: true,
      completedBy: ctx.actor?.id,
      completedAt: ctx.now.toISOString(),
      ...(notes && { completionNotes: notes }),
      ...(evidence && { evidenceDocuments: evidence }),
    });

    return ActionState.COMPLETED;
  }

  async fail(
    ctx: WorkflowRuntimeContext<TaskConfig, TaskData>,
    reason: string,
  ): Promise<ActionState> {
    // Store failure reason in context
    ctx.updateContext({
      taskFailed: true,
      failureReason: reason,
      failedAt: ctx.now.toISOString(),
    });

    return ActionState.FAILED;
  }

  getNextStateOnEvent(): ActionState | null {
    // Tasks don't respond to external events
    return null;
  }
}
