import { ActionState, Role, WorkflowInstance } from "@prisma/client";
import type { Prisma, PrismaClient } from "@prisma/client";
import { actionRegistry } from "./registry";
import { ActionHandlerError } from "./errors";
import { assertTransition, isTerminal } from "./state-machine";
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
  return {
    tx,
    instance,
    step,
    actor,
    config,
    data,
    now,
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
  now: Date,
): Promise<void> {
  await tx.workflowInstanceStep.update({
    where: { id: step.id },
    data: {
      actionState: targetState,
      actionData: data as JsonValue,
      startedAt: step.startedAt ?? now,
      completedAt: targetState === ActionState.COMPLETED ? now : step.completedAt,
      updatedAt: now,
    },
  });
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
  if (step.actionState !== ActionState.READY) {
    throw new ActionHandlerError(`Step ${step.id} is not in READY state`, "INVALID_STATE");
  }

  const handler = actionRegistry.get(step.actionType);
  const context = buildContext(step, instance, tx, actor, now);
  handler.validateConfig(context.config);

  if (!handler.canStart(context)) {
    throw new ActionHandlerError(`Handler denies start for step ${step.id}`, "PRECONDITION_FAILED");
  }

  const resultState = (await handler.start(context)) ?? ActionState.IN_PROGRESS;
  assertTransition(step.actionState, resultState, { actor });

  const data = appendHistory(ensureActionData(step), {
    at: now.toISOString(),
    by: actor?.id,
    event: resultState === ActionState.IN_PROGRESS ? "STARTED" : `STATE_${resultState}`,
  });

  await persistStepUpdate(tx, step, data, resultState, now);
  return resultState;
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
  ensureCanMutate(step, actor);

  const handler = actionRegistry.get(step.actionType);
  const context = buildContext(step, instance, tx, actor, now);
  handler.validateConfig(context.config);

  const resultState = (await handler.complete(context, payload)) ?? ActionState.COMPLETED;
  assertTransition(step.actionState, resultState, { actor });

  const data = appendHistory(ensureActionData(step), {
    at: now.toISOString(),
    by: actor?.id,
    event: resultState === ActionState.COMPLETED ? "COMPLETED" : `STATE_${resultState}`,
    payload,
  });

  await persistStepUpdate(tx, step, data, resultState, now);
  return resultState;
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
  ensureCanMutate(step, actor);

  const handler = actionRegistry.get(step.actionType);
  const context = buildContext(step, instance, tx, actor, now);
  handler.validateConfig(context.config);

  const resultState = (await handler.fail(context, reason)) ?? ActionState.FAILED;
  assertTransition(step.actionState, resultState, { actor });

  const data = appendHistory(ensureActionData(step), {
    at: now.toISOString(),
    by: actor?.id,
    event: "FAILED",
    payload: { reason },
  });

  await persistStepUpdate(tx, step, data, resultState, now);
  return resultState;
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

  const data = appendHistory(ensureActionData(step), {
    at: now.toISOString(),
    by: actor?.id,
    event: `EVENT_${event.type}`,
    payload: event.payload,
  });

  await persistStepUpdate(tx, step, data, nextState, now);
  return nextState;
}
