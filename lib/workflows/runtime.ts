import { ActionState, Role, WorkflowInstance, WorkflowInstanceDependency } from "@prisma/client";
import type { Prisma, PrismaClient } from "@prisma/client";
import { actionRegistry } from "./registry";
import { ActionHandlerError } from "./errors";
import { assertTransition, isTerminal } from "./state-machine";
import { WorkflowMetrics, createWorkflowSpan } from "./observability";
import { getReadySteps } from "./dependency-resolver";
import type {
  ActionEvent,
  WorkflowActor,
  WorkflowInstanceStepWithTemplate,
  WorkflowRuntimeContext,
} from "./types";

type JsonValue = Prisma.JsonValue;
type JsonObject = Prisma.JsonObject;

const HISTORY_KEY = "history";
const CONFIG_KEY = "config";

type ActionHistoryEntry = {
  at: string;
  by?: string;
  event: string;
  payload?: JsonValue;
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
      payload: payload ? cloneJson(payload as JsonValue) : undefined,
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
    if (resultState === ActionState.COMPLETED) {
      const branchDecision = inferBranchDecision(payload, context.data);
      await resolveBranchingTransitions({
        tx,
        instance,
        completedStep: step,
        decision: branchDecision,
        now,
      });
    }

    if (resultState === ActionState.COMPLETED) {
      const { notifyStepCompleted } = await import("./notifications");
      await notifyStepCompleted(tx, step.id);
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

type BranchDefinition = {
  targetStepId: string;
  condition?: string;
  label?: string;
};

const TRUE_BRANCH_VALUES = new Set(["true", "yes", "approved", "success", "pass"]);
const FALSE_BRANCH_VALUES = new Set(["false", "no", "rejected", "reject", "fail", "denied"]);

function inferBranchDecision(payload: unknown, actionData: unknown): boolean | undefined {
  if (typeof payload === "boolean") {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    const directBooleanKeys: Array<keyof typeof record> = ["approved", "branchDecision", "result"];
    for (const key of directBooleanKeys) {
      const value = record[key];
      if (typeof value === "boolean") {
        return value;
      }
    }

    const nestedDecision = record.decision;
    if (nestedDecision && typeof nestedDecision === "object") {
      const approved = (nestedDecision as Record<string, unknown>).approved;
      if (typeof approved === "boolean") {
        return approved;
      }
    }
  }

  if (actionData && typeof actionData === "object") {
    const record = actionData as Record<string, unknown>;

    const directCandidates = [record.branchDecision, record.approved];
    for (const candidate of directCandidates) {
      if (typeof candidate === "boolean") {
        return candidate;
      }
    }

    const nested = record.decision;
    if (nested && typeof nested === "object") {
      const approved = (nested as Record<string, unknown>).approved;
      if (typeof approved === "boolean") {
        return approved;
      }
    }
  }

  return undefined;
}

async function resolveBranchingTransitions({
  tx,
  instance,
  completedStep,
  decision,
  now,
}: {
  tx: PrismaClient | Prisma.TransactionClient;
  instance: WorkflowInstance;
  completedStep: WorkflowInstanceStepWithTemplate;
  decision?: boolean;
  now: Date;
}): Promise<void> {
  const branches = extractBranchDefinitions(completedStep);
  if (branches.length === 0) {
    return;
  }

  const normalized = branches.map((branch) => ({
    ...branch,
    condition: branch.condition?.toString().trim().toLowerCase(),
  }));

  const trueBranches = normalized.filter(
    (branch) => branch.condition && TRUE_BRANCH_VALUES.has(branch.condition),
  );
  const falseBranches = normalized.filter(
    (branch) => branch.condition && FALSE_BRANCH_VALUES.has(branch.condition),
  );
  const neutralBranches = normalized.filter(
    (branch) =>
      !branch.condition ||
      (!TRUE_BRANCH_VALUES.has(branch.condition) && !FALSE_BRANCH_VALUES.has(branch.condition)),
  );

  let chosen: (typeof normalized)[number] | undefined;

  if (decision === true) {
    chosen = trueBranches[0] ?? neutralBranches[0];
  } else if (decision === false) {
    chosen = falseBranches[0] ?? neutralBranches[0];
  } else if (neutralBranches.length === 1 && normalized.length === 1) {
    chosen = neutralBranches[0];
  } else if (normalized.length === 1) {
    chosen = normalized[0];
  } else {
    // Without a decision we cannot safely choose among multiple branches
    return;
  }

  if (!chosen) {
    return;
  }

  if (chosen.targetStepId !== completedStep.id) {
    await activateBranchTarget({
      tx,
      instanceId: instance.id,
      sourceStepId: completedStep.id,
      targetStepId: chosen.targetStepId,
      now,
    });
  }

  if (typeof decision === "boolean") {
    for (const branch of normalized) {
      if (branch === chosen) {
        continue;
      }
      if (branch.targetStepId === completedStep.id) {
        continue;
      }

      const reasonParts = [branch.label, branch.condition].filter(Boolean);
      const skipReason = reasonParts.length > 0
        ? `Skipped by branch (${reasonParts.join(" / ")})`
        : "Skipped by branch selection";

      await skipBranchTarget({
        tx,
        instanceId: instance.id,
        sourceStepId: completedStep.id,
        targetStepId: branch.targetStepId,
        now,
        reason: skipReason,
      });
    }
  }
}

function extractBranchDefinitions(step: WorkflowInstanceStepWithTemplate): BranchDefinition[] {
  const definitions: BranchDefinition[] = [];
  const seen = new Set<string>();

  const pushBranch = (target: unknown, condition?: unknown, label?: unknown) => {
    if (typeof target !== "string" || target.trim().length === 0) {
      return;
    }
    const key = `${target}|${condition ?? ""}|${label ?? ""}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    definitions.push({
      targetStepId: target,
      condition:
        typeof condition === "string"
          ? condition
          : typeof condition === "boolean"
            ? condition.toString()
            : undefined,
      label: typeof label === "string" ? label : undefined,
    });
  };

  const stepWithBranches = step as unknown as { branches?: unknown };
  const templateWithBranches = step.templateStep as unknown as { branches?: unknown } | null;
  const branchSources = [stepWithBranches?.branches, templateWithBranches?.branches];

  for (const source of branchSources) {
    if (!Array.isArray(source)) {
      continue;
    }
    for (const branch of source) {
      if (!branch || typeof branch !== "object") {
        continue;
      }
      const record = branch as Record<string, unknown>;
      const target =
        record.targetStepId ?? record.targetId ?? record.target ?? record.targetStep;
      const condition = record.condition ?? record.when;
      const label = record.label ?? record.name;
      pushBranch(target, condition, label);
    }
  }

  return definitions;
}

async function activateBranchTarget({
  tx,
  instanceId,
  sourceStepId: _sourceStepId,
  targetStepId,
  now,
}: {
  tx: PrismaClient | Prisma.TransactionClient;
  instanceId: string;
  sourceStepId: string;
  targetStepId: string;
  now: Date;
}): Promise<void> {
  const target = await tx.workflowInstanceStep.findUnique({
    where: { id: targetStepId },
    select: {
      id: true,
      instanceId: true,
      actionState: true,
      actionType: true,
    },
  });

  if (!target || target.instanceId !== instanceId) {
    return;
  }

  // TODO: Update dependency logic to use WorkflowInstanceDependency table
  // For now, just transition eligible states to READY
  const eligibleStates = new Set<ActionState>([
    ActionState.PENDING,
    ActionState.BLOCKED,
    ActionState.SKIPPED,
  ]);
  const canTransition = eligibleStates.has(target.actionState);

  if (!canTransition) {
    return;
  }

  const updateData: Prisma.WorkflowInstanceStepUpdateInput = {
    actionState: ActionState.READY,
    updatedAt: now,
  };

  const previousState = target.actionState;
  await tx.workflowInstanceStep.update({
    where: { id: target.id },
    data: updateData,
  });

  if (canTransition && previousState !== ActionState.READY) {
    WorkflowMetrics.recordStepAdvanced(target.actionType);
    WorkflowMetrics.recordTransition(target.actionType, previousState, ActionState.READY);
    const { notifyStepReady } = await import("./notifications");
    await notifyStepReady(tx, target.id);
  }
}

async function skipBranchTarget({
  tx,
  instanceId,
  sourceStepId: _sourceStepId,
  targetStepId,
  now,
  reason,
}: {
  tx: PrismaClient | Prisma.TransactionClient;
  instanceId: string;
  sourceStepId: string;
  targetStepId: string;
  now: Date;
  reason?: string;
}): Promise<void> {
  const target = await tx.workflowInstanceStep.findUnique({
    where: { id: targetStepId },
    select: {
      id: true,
      instanceId: true,
      actionState: true,
      actionType: true,
      notes: true,
    },
  });

  if (!target || target.instanceId !== instanceId) {
    return;
  }

  // TODO: Update dependency logic to use WorkflowInstanceDependency table
  // For now, just skip eligible states
  const isSkippable = !(target.actionState === ActionState.COMPLETED || target.actionState === ActionState.SKIPPED || target.actionState === ActionState.FAILED);
  const shouldUpdateNotes = Boolean(
    reason && (!target.notes || target.notes.trim().length === 0),
  );

  if (!isSkippable && !shouldUpdateNotes) {
    return;
  }

  const updateData: Prisma.WorkflowInstanceStepUpdateInput = {
    updatedAt: now,
  };

  const previousState = target.actionState;
  if (isSkippable) {
    updateData.actionState = ActionState.SKIPPED;
  }

  if (shouldUpdateNotes && reason) {
    updateData.notes = reason;
  }

  await tx.workflowInstanceStep.update({
    where: { id: target.id },
    data: updateData,
  });

  if (isSkippable && previousState !== ActionState.SKIPPED) {
    WorkflowMetrics.recordTransition(target.actionType, previousState, ActionState.SKIPPED);
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
    if (resultState === ActionState.FAILED) {
      const { notifyStepFailed } = await import("./notifications");
      await notifyStepFailed(tx, step.id);
    }
    
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
    payload: event.payload ? cloneJson(event.payload as JsonValue) : undefined,
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
    // Get all steps and dependencies for this instance
    const steps = await tx.workflowInstanceStep.findMany({
      where: { instanceId: instance.id },
      include: {
        templateStep: true,
        instance: true,
      },
    });

    const dependencies = await tx.workflowInstanceDependency.findMany({
      where: { instanceId: instance.id },
    });

    let activatedCount = 0;
    const stepModels = steps.map(toStepWithTemplate);

    // ⭐ NEW: Use dependency resolver to find steps that are ready
    let readySteps = getReadySteps(stepModels, dependencies);

    // Activate each ready step
    for (const step of readySteps) {
      // Only activate if currently PENDING
      if (step.actionState !== ActionState.PENDING) {
        continue;
      }

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
