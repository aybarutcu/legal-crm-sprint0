import { ActionState, Role, WorkflowInstance } from "@prisma/client";
import type { Prisma, PrismaClient } from "@prisma/client";
import { actionRegistry } from "./registry";
import { ActionHandlerError } from "./errors";
import { assertTransition, isTerminal } from "./state-machine";
import { WorkflowMetrics, createWorkflowSpan } from "./observability";
import { ConditionEvaluator } from "./conditions";
import type { ConditionConfig } from "./conditions/types";
import { getReadySteps } from "./dependency-resolver";
import type {
  ActionEvent,
  WorkflowActor,
  WorkflowInstanceStepWithTemplate,
  WorkflowRuntimeContext,
} from "./types";

// TODO: Remove once Prisma generates ConditionType enum
type ConditionType = "ALWAYS" | "IF_TRUE" | "IF_FALSE" | "SWITCH";

// Extended type with conditional fields (until Prisma regenerates types)
type WorkflowInstanceStepWithConditions = WorkflowInstanceStepWithTemplate & {
  conditionType?: ConditionType | null;
  conditionConfig?: Prisma.JsonValue | null;
  nextStepOnTrue?: number | null;
  nextStepOnFalse?: number | null;
};

type JsonValue = Prisma.JsonValue;
type JsonObject = Prisma.JsonObject;

const HISTORY_KEY = "history";
const CONFIG_KEY = "config";

type ActionHistoryEntry = {
  at: string;
  by?: string;
  event: string;
  payload?: unknown;
};

function isJsonObject(value: JsonValue): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneJson<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T;
}

function ensureActionData(step: WorkflowInstanceStepWithTemplate): JsonObject {
  const existing = isJsonObject(step.actionData) ? cloneJson(step.actionData) : {};
  if (!existing[CONFIG_KEY] && isJsonObject(step.templateStep?.actionConfig ?? null)) {
    existing[CONFIG_KEY] = cloneJson(step.templateStep!.actionConfig as JsonObject);
  }
  if (!Array.isArray(existing[HISTORY_KEY])) {
    existing[HISTORY_KEY] = [];
  }
  return existing;
}

function appendHistory(data: JsonObject, entry: ActionHistoryEntry): JsonObject {
  const history = Array.isArray(data[HISTORY_KEY]) ? [...(data[HISTORY_KEY] as ActionHistoryEntry[])] : [];
  history.push(entry);
  return {
    ...data,
    [HISTORY_KEY]: history,
  };
}

function extractConfig<TConfig>(step: WorkflowInstanceStepWithTemplate): TConfig {
  if (step.templateStep?.actionConfig) {
    return step.templateStep.actionConfig as TConfig;
  }
  const data = step.actionData;
  if (isJsonObject(data) && CONFIG_KEY in data) {
    return data[CONFIG_KEY] as TConfig;
  }
  return {} as TConfig;
}

function buildContext<TConfig, TData>(
  step: WorkflowInstanceStepWithTemplate,
  instance: WorkflowInstance,
  tx: PrismaClient | Prisma.TransactionClient,
  actor: WorkflowActor | undefined,
  now: Date,
): WorkflowRuntimeContext<TConfig, TData> {
  const config = extractConfig<TConfig>(step);
  const data = ensureActionData(step) as unknown as TData;
  const instanceWithContext = instance as WorkflowInstance & { contextData?: Prisma.JsonValue };
  const contextData = isJsonObject(instanceWithContext.contextData ?? null) 
    ? instanceWithContext.contextData as Record<string, unknown> 
    : {};
  
  // Track context mutations
  const contextUpdates: Record<string, unknown> = {};
  
  return {
    tx,
    instance,
    step,
    actor,
    config,
    data,
    now,
    context: contextData,
    
    // Method to queue context updates
    updateContext: (updates: Record<string, unknown>) => {
      Object.assign(contextUpdates, updates);
      Object.assign(contextData, updates); // Also update local copy for read-after-write
    },
    
    // Internal: Get pending updates
    _getContextUpdates: () => contextUpdates,
  };
}

function ensureCanMutate(step: WorkflowInstanceStepWithTemplate, actor?: WorkflowActor) {
  if (isTerminal(step.actionState)) {
    throw new ActionHandlerError(`Step ${step.id} is already in terminal state ${step.actionState}`, "STEP_LOCKED");
  }
  if (step.actionState === ActionState.PENDING) {
    throw new ActionHandlerError(`Step ${step.id} is not ready to start`, "STEP_NOT_READY");
  }
  if (!actor) {
    return;
  }
  if (step.roleScope === "ADMIN" && actor.role !== Role.ADMIN) {
    throw new ActionHandlerError(`Only admins can mutate this step`, "NOT_AUTHORIZED");
  }
}

async function persistStepUpdate(
  tx: PrismaClient | Prisma.TransactionClient,
  step: WorkflowInstanceStepWithTemplate,
  data: JsonObject,
  targetState: ActionState,
  contextUpdates: Record<string, unknown>,
  now: Date,
): Promise<void> {
  // Update step state
  await tx.workflowInstanceStep.update({
    where: { id: step.id },
    data: {
      actionState: targetState,
      actionData: data as Prisma.InputJsonValue,
      startedAt: step.startedAt ?? now,
      completedAt: targetState === ActionState.COMPLETED ? now : step.completedAt,
      updatedAt: now,
    },
  });
  
  // Update instance context if there are changes
  if (Object.keys(contextUpdates).length > 0) {
    const instanceWithContext = step.instance as typeof step.instance & { contextData?: Prisma.JsonValue };
    const existingContext = isJsonObject(instanceWithContext.contextData ?? null)
      ? instanceWithContext.contextData as Record<string, unknown>
      : {};
    
    const mergedContext = {
      ...existingContext,
      ...contextUpdates,
    };
    
    // TODO: Type assertion needed until Prisma types are fully regenerated
    // eslint-disable-next-line @typescript-eslint/ban-types
    await (tx.workflowInstance.update as Function)({
      where: { id: step.instance.id },
      data: {
        contextData: mergedContext as Prisma.InputJsonValue,
        updatedAt: now,
      },
    });
  }
}

export async function startWorkflowStep({
  tx,
  instance,
  step,
  actor,
  now = new Date(),
}: {
  tx: PrismaClient | Prisma.TransactionClient;
  instance: WorkflowInstance;
  step: WorkflowInstanceStepWithTemplate;
  actor?: WorkflowActor;
  now?: Date;
}): Promise<ActionState> {
  const span = createWorkflowSpan("workflow.step.start", {
    stepId: step.id,
    actionType: step.actionType,
    instanceId: instance.id,
  });

  try {
    if (step.actionState !== ActionState.READY) {
      throw new ActionHandlerError(`Step ${step.id} is not in READY state`, "INVALID_STATE");
    }

    const handler = actionRegistry.get(step.actionType);
    const context = buildContext(step, instance, tx, actor, now);
    handler.validateConfig(context.config);

    if (!handler.canStart(context)) {
      throw new ActionHandlerError(`Handler denies start for step ${step.id}`, "PRECONDITION_FAILED");
    }

    const handlerStart = Date.now();
    const resultState = (await handler.start(context)) ?? ActionState.IN_PROGRESS;
    const handlerDuration = Date.now() - handlerStart;
    
    assertTransition(step.actionState, resultState, { actor });

    // Use the modified context.data instead of re-fetching from step
    const data = appendHistory(context.data as unknown as JsonObject, {
      at: now.toISOString(),
      by: actor?.id,
      event: resultState === ActionState.IN_PROGRESS ? "STARTED" : `STATE_${resultState}`,
    });

    // Get context updates from handler
    const contextUpdates = context._getContextUpdates?.() || {};
    
    await persistStepUpdate(tx, step, data, resultState, contextUpdates, now);
    
    // Record metrics
    WorkflowMetrics.recordStepStart(step.actionType);
    WorkflowMetrics.recordTransition(step.actionType, step.actionState, resultState);
    WorkflowMetrics.recordHandlerDuration(step.actionType, "start", handlerDuration);
    
    span.end(true);
    return resultState;
  } catch (error) {
    if (error instanceof Error) {
      WorkflowMetrics.recordHandlerError(step.actionType, "start", error.name);
      span.endWithError(error);
    } else {
      span.end(false);
    }
    throw error;
  }
}

export async function completeWorkflowStep({
  tx,
  instance,
  step,
  actor,
  payload,
  now = new Date(),
}: {
  tx: PrismaClient | Prisma.TransactionClient;
  instance: WorkflowInstance;
  step: WorkflowInstanceStepWithTemplate;
  actor?: WorkflowActor;
  payload?: unknown;
  now?: Date;
}): Promise<ActionState> {
  const span = createWorkflowSpan("workflow.step.complete", {
    stepId: step.id,
    actionType: step.actionType,
    instanceId: instance.id,
  });

  try {
    ensureCanMutate(step, actor);

    const handler = actionRegistry.get(step.actionType);
    const context = buildContext(step, instance, tx, actor, now);
    handler.validateConfig(context.config);

    const handlerStart = Date.now();
    const resultState = (await handler.complete(context, payload)) ?? ActionState.COMPLETED;
    const handlerDuration = Date.now() - handlerStart;
    
    assertTransition(step.actionState, resultState, { actor });

    // Use the modified context.data instead of re-fetching from step
    const data = appendHistory(context.data as unknown as JsonObject, {
      at: now.toISOString(),
      by: actor?.id,
      event: resultState === ActionState.COMPLETED ? "COMPLETED" : `STATE_${resultState}`,
      payload,
    });

    // Get context updates from handler
    const contextUpdates = context._getContextUpdates?.() || {};
    
    await persistStepUpdate(tx, step, data, resultState, contextUpdates, now);
    
    // Record metrics
    WorkflowMetrics.recordTransition(step.actionType, step.actionState, resultState);
    WorkflowMetrics.recordHandlerDuration(step.actionType, "complete", handlerDuration);
    
    // Record cycle time if step is completing
    if (resultState === ActionState.COMPLETED && step.startedAt) {
      const cycleTime = now.getTime() - step.startedAt.getTime();
      WorkflowMetrics.recordCycleTime(step.actionType, cycleTime);
    }
    
    span.end(true);
    return resultState;
  } catch (error) {
    if (error instanceof Error) {
      WorkflowMetrics.recordHandlerError(step.actionType, "complete", error.name);
      span.endWithError(error);
    } else {
      span.end(false);
    }
    throw error;
  }
}

export async function failWorkflowStep({
  tx,
  instance,
  step,
  actor,
  reason,
  now = new Date(),
}: {
  tx: PrismaClient | Prisma.TransactionClient;
  instance: WorkflowInstance;
  step: WorkflowInstanceStepWithTemplate;
  actor?: WorkflowActor;
  reason: string;
  now?: Date;
}): Promise<ActionState> {
  const span = createWorkflowSpan("workflow.step.fail", {
    stepId: step.id,
    actionType: step.actionType,
    instanceId: instance.id,
  });

  try {
    ensureCanMutate(step, actor);

    const handler = actionRegistry.get(step.actionType);
    const context = buildContext(step, instance, tx, actor, now);
    handler.validateConfig(context.config);

    const handlerStart = Date.now();
    const resultState = (await handler.fail(context, reason)) ?? ActionState.FAILED;
    const handlerDuration = Date.now() - handlerStart;
    
    assertTransition(step.actionState, resultState, { actor });

    // Use the modified context.data instead of re-fetching from step
    const data = appendHistory(context.data as unknown as JsonObject, {
      at: now.toISOString(),
      by: actor?.id,
      event: "FAILED",
      payload: { reason },
    });

    // Get context updates from handler
    const contextUpdates = context._getContextUpdates?.() || {};
    
    await persistStepUpdate(tx, step, data, resultState, contextUpdates, now);
    
    // Record metrics
    WorkflowMetrics.recordTransition(step.actionType, step.actionState, resultState);
    WorkflowMetrics.recordHandlerDuration(step.actionType, "fail", handlerDuration);
    
    span.end(true);
    return resultState;
  } catch (error) {
    if (error instanceof Error) {
      WorkflowMetrics.recordHandlerError(step.actionType, "fail", error.name);
      span.endWithError(error);
    } else {
      span.end(false);
    }
    throw error;
  }
}

/**
 * Skip a workflow step (admin only, non-required steps only)
 */
export async function skipWorkflowStep({
  tx,
  instance: _instance,
  step,
  actor,
  reason,
  now = new Date(),
}: {
  tx: PrismaClient | Prisma.TransactionClient;
  instance: WorkflowInstance;
  step: WorkflowInstanceStepWithTemplate;
  actor: WorkflowActor; // Required for skip - must be admin
  reason?: string;
  now?: Date;
}): Promise<ActionState> {
  // Import canSkipStep dynamically to avoid circular dependency
  const { canSkipStep } = await import("./state-machine");
  
  // Check if the step can be skipped
  const skipCheck = canSkipStep(step, actor);
  if (!skipCheck.canSkip) {
    throw new ActionHandlerError(
      skipCheck.reason ?? "This step cannot be skipped",
      "SKIP_NOT_ALLOWED",
    );
  }

  // Verify the actor has admin role
  if (actor.role !== Role.ADMIN) {
    throw new ActionHandlerError("Only administrators can skip workflow steps", "PERMISSION_DENIED");
  }

  const span = createWorkflowSpan("workflow.step.skip", {
    stepId: step.id,
    actionType: step.actionType,
    instanceId: _instance.id,
  });

  try {
    const resultState = ActionState.SKIPPED;
    assertTransition(step.actionState, resultState, { actor });

    // Build context to get actionData properly
    const context = buildContext(step, _instance, tx, actor, now);
    
    // Use the context.data instead of re-fetching from step
    const data = appendHistory(context.data as unknown as JsonObject, {
      at: now.toISOString(),
      by: actor.id,
      event: "SKIPPED",
      payload: { reason: reason ?? "Step skipped by administrator" },
    });

    // No context updates for skipped steps
    const contextUpdates = {};
    
    await persistStepUpdate(tx, step, data, resultState, contextUpdates, now);
    
    // Record metrics
    WorkflowMetrics.recordTransition(step.actionType, step.actionState, resultState);
    
    span.end(true);
    return resultState;
  } catch (error) {
    if (error instanceof Error) {
      span.endWithError(error);
    } else {
      span.end(false);
    }
    throw error;
  }
}

export async function applyEventToWorkflowStep({
  tx,
  instance,
  step,
  event,
  actor,
  now = new Date(),
}: {
  tx: PrismaClient | Prisma.TransactionClient;
  instance: WorkflowInstance;
  step: WorkflowInstanceStepWithTemplate;
  event: ActionEvent;
  actor?: WorkflowActor;
  now?: Date;
}): Promise<ActionState | null> {
  if (isTerminal(step.actionState)) {
    return null;
  }

  const handler = actionRegistry.get(step.actionType);
  const context = buildContext(step, instance, tx, actor, now);
  handler.validateConfig(context.config);

  const nextState = handler.getNextStateOnEvent(context, event);
  if (!nextState || nextState === step.actionState) {
    return null;
  }

  assertTransition(step.actionState, nextState, { actor });

  // Use the context.data instead of re-fetching from step
  const data = appendHistory(context.data as unknown as JsonObject, {
    at: now.toISOString(),
    by: actor?.id,
    event: `EVENT_${event.type}`,
    payload: event.payload,
  });

  // Get context updates from handler
  const contextUpdates = context._getContextUpdates?.() || {};
  
  await persistStepUpdate(tx, step, data, nextState, contextUpdates, now);
  return nextState;
}

/**
 * Determine which steps should be activated next based on conditional logic.
 * 
 * This function:
 * 1. Finds the next PENDING step(s) in order
 * 2. Evaluates any conditions on those steps
 * 3. Activates steps that meet their conditions (IF_TRUE) or skips them
 * 4. Handles unconditional steps (ALWAYS or no condition)
 * 5. Returns the number of steps activated
 * 
 * @param tx - Prisma client or transaction
 * @param instance - Workflow instance (with contextData)
 * @param completedStep - The step that just completed (provides context for evaluation)
 * @returns Number of steps activated
 */
export async function determineNextSteps({
  tx,
  instance,
  completedStep,
  now = new Date(),
}: {
  tx: PrismaClient | Prisma.TransactionClient;
  instance: WorkflowInstance;
  completedStep?: WorkflowInstanceStepWithTemplate;
  now?: Date;
}): Promise<number> {
  const span = createWorkflowSpan("workflow.determineNextSteps", {
    instanceId: instance.id,
    completedStepId: completedStep?.id ?? "none",
  });

  try {
    // Get all steps for this instance, ordered
    const steps = await tx.workflowInstanceStep.findMany({
      where: { instanceId: instance.id },
      orderBy: { order: "asc" },
      include: {
        templateStep: true,
        instance: true,
      },
    });

    let activatedCount = 0;
    const stepModels = steps.map(toStepWithTemplate) as WorkflowInstanceStepWithConditions[];

    // Build evaluation context (for conditional logic evaluation)
    const evalContext: WorkflowRuntimeContext = {
      tx,
      instance,
      step: completedStep ?? stepModels[0],
      actor: undefined,
      config: {},
      data: {},
      now,
      context: isJsonObject(instance.contextData ?? null)
        ? (instance.contextData as Record<string, unknown>)
        : {},
      updateContext: () => {
        // No-op for evaluation context
      },
    };

    // ⭐ NEW: Use dependency resolver to find steps that are ready
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const readySteps = getReadySteps(stepModels as any);

    // Activate each ready step (check conditions and update state)
    for (const step of readySteps) {
      // Only activate if currently PENDING
      if (step.actionState !== ActionState.PENDING) {
        continue;
      }

      // Check if this step has a condition
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conditionType: ConditionType = (step as any).conditionType ?? "ALWAYS";

      if (conditionType === "ALWAYS" || !conditionType) {
        // No condition - activate immediately
        await tx.workflowInstanceStep.update({
          where: { id: step.id },
          data: {
            actionState: ActionState.READY,
            updatedAt: now,
          },
        });
        activatedCount++;

        // Record metrics
        WorkflowMetrics.recordStepAdvanced(step.actionType);
        WorkflowMetrics.recordTransition(step.actionType, ActionState.PENDING, ActionState.READY);

        // Send notification
        const { notifyStepReady } = await import("./notifications");
        await notifyStepReady(tx, step.id);
      } else if (conditionType === "IF_TRUE" || conditionType === "IF_FALSE") {
        // Has a condition - evaluate it
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(step as any).conditionConfig) {
          console.warn(
            `Step ${step.id} has conditionType ${conditionType} but no conditionConfig`,
          );
          continue;
        }

        // Evaluate the condition
        const result = ConditionEvaluator.evaluate(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (step as any).conditionConfig as unknown as ConditionConfig,
          evalContext,
        );

        if (!result.success) {
          console.error(
            `Failed to evaluate condition for step ${step.id}: ${result.error}`,
          );
          continue;
        }

        // Determine if this step should be activated or skipped
        const shouldActivate =
          (conditionType === "IF_TRUE" && result.value === true) ||
          (conditionType === "IF_FALSE" && result.value === false);

        if (shouldActivate) {
          // Activate the step
          await tx.workflowInstanceStep.update({
            where: { id: step.id },
            data: {
              actionState: ActionState.READY,
              updatedAt: now,
            },
          });
          activatedCount++;

          // Record metrics
          WorkflowMetrics.recordStepAdvanced(step.actionType);
          WorkflowMetrics.recordTransition(step.actionType, ActionState.PENDING, ActionState.READY);

          // Send notification
          const { notifyStepReady } = await import("./notifications");
          await notifyStepReady(tx, step.id);
        } else {
          // Skip the step (condition not met)
          await tx.workflowInstanceStep.update({
            where: { id: step.id },
            data: {
              actionState: ActionState.SKIPPED,
              notes: `Skipped: Condition not met (${conditionType}, evaluated to ${result.value})`,
              updatedAt: now,
            },
          });

          // Record metrics for skipped step
          WorkflowMetrics.recordTransition(step.actionType, ActionState.PENDING, ActionState.SKIPPED);
        }
      }
      // Note: SWITCH type will be implemented in future enhancement
    }

    span.end(true);
    return activatedCount;
  } catch (error) {
    if (error instanceof Error) {
      span.endWithError(error);
    } else {
      span.end(false);
    }
    throw error;
  }
}

// Helper function to convert Prisma step to our type
function toStepWithTemplate(
  step: Prisma.WorkflowInstanceStepGetPayload<{
    include: { templateStep: true; instance: true };
  }>,
): WorkflowInstanceStepWithTemplate {
  return step as unknown as WorkflowInstanceStepWithTemplate;
}
