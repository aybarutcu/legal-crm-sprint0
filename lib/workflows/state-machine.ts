import { ActionState, Role } from "@prisma/client";
import { WorkflowTransitionError } from "./errors";
import type { WorkflowActionGuardOptions, WorkflowInstanceStepWithTemplate } from "./types";

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

/**
 * Check if a step can be skipped based on its required field and actor permissions
 * @param step - The workflow step to check
 * @param actor - The actor attempting to skip
 * @returns true if the step can be skipped, false otherwise
 */
export function canSkipStep(
  step: WorkflowInstanceStepWithTemplate,
  actor?: { id: string; role: Role },
): { canSkip: boolean; reason?: string } {
  // Only admins can skip steps
  if (!actor || actor.role !== Role.ADMIN) {
    return {
      canSkip: false,
      reason: "Only administrators can skip workflow steps",
    };
  }

  // Check if the step is marked as required
  const isRequired = step.templateStep?.required ?? true; // Default to required if not specified
  
  if (isRequired) {
    return {
      canSkip: false,
      reason: "This step is marked as required and cannot be skipped",
    };
  }

  return { canSkip: true };
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
