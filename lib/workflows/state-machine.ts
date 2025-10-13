import { ActionState, Role } from "@prisma/client";
import { WorkflowTransitionError } from "./errors";
import type { WorkflowActionGuardOptions } from "./types";

const NEXT_STATE_MAP: Record<ActionState, readonly ActionState[]> = {
  [ActionState.PENDING]: [ActionState.READY],
  [ActionState.READY]: [ActionState.IN_PROGRESS, ActionState.SKIPPED],
  [ActionState.IN_PROGRESS]: [
    ActionState.COMPLETED,
    ActionState.FAILED,
    ActionState.BLOCKED,
    ActionState.SKIPPED,
  ],
  [ActionState.BLOCKED]: [ActionState.READY, ActionState.SKIPPED],
  [ActionState.COMPLETED]: [],
  [ActionState.FAILED]: [ActionState.READY],
  [ActionState.SKIPPED]: [],
};

const ADMIN_ONLY_TARGETS = new Set<ActionState>([ActionState.SKIPPED]);

export function canTransition(from: ActionState, to: ActionState, options?: WorkflowActionGuardOptions): boolean {
  if (from === to) {
    return true;
  }
  const allowed = NEXT_STATE_MAP[from] ?? [];
  if (!allowed.includes(to)) {
    return false;
  }
  if (ADMIN_ONLY_TARGETS.has(to)) {
    return options?.actor?.role === Role.ADMIN || options?.allowAdminOverride === true;
  }
  return true;
}

export function assertTransition(
  from: ActionState,
  to: ActionState,
  options?: WorkflowActionGuardOptions,
): void {
  if (!canTransition(from, to, options)) {
    throw new WorkflowTransitionError(`Transition from ${from} to ${to} is not permitted`);
  }
}

export function isTerminal(state: ActionState): boolean {
  return state === ActionState.COMPLETED || state === ActionState.FAILED || state === ActionState.SKIPPED;
}
