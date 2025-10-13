import { Role } from "@prisma/client";
import type { ActionPermissionContext, ActionPermissionCheck } from "./types";
import { resolveEligibleActorIds } from "./roles";

export function canPerformAction({
  actor,
  step,
  snapshot,
}: ActionPermissionContext): ActionPermissionCheck {
  if (actor.role === Role.ADMIN) {
    return { canPerform: true };
  }

  const eligibleIds = resolveEligibleActorIds(step.roleScope, snapshot);
  if (eligibleIds.includes(actor.id)) {
    return { canPerform: true };
  }

  return {
    canPerform: false,
    reason: `Actor ${actor.id} is not eligible for role scope ${step.roleScope}`,
  };
}
