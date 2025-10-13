import { describe, expect, it } from "vitest";
import { ActionState, Role } from "@prisma/client";
import { assertTransition, canTransition } from "@/lib/workflows/state-machine";
import { WorkflowTransitionError } from "@/lib/workflows/errors";

describe("workflow state machine", () => {
  it("allows PENDING -> READY transition", () => {
    expect(canTransition(ActionState.PENDING, ActionState.READY)).toBe(true);
  });

  it("rejects PENDING -> COMPLETED transition", () => {
    expect(canTransition(ActionState.PENDING, ActionState.COMPLETED)).toBe(false);
    expect(() => assertTransition(ActionState.PENDING, ActionState.COMPLETED)).toThrow(WorkflowTransitionError);
  });

  it("restricts SKIPPED transitions to admins", () => {
    expect(
      canTransition(ActionState.READY, ActionState.SKIPPED, { actor: { id: "user-1", role: Role.LAWYER } }),
    ).toBe(false);
    expect(() =>
      assertTransition(ActionState.READY, ActionState.SKIPPED, { actor: { id: "user-1", role: Role.LAWYER } }),
    ).toThrow(WorkflowTransitionError);

    expect(
      canTransition(ActionState.READY, ActionState.SKIPPED, { actor: { id: "admin-1", role: Role.ADMIN } }),
    ).toBe(true);
    expect(() =>
      assertTransition(ActionState.READY, ActionState.SKIPPED, {
        actor: { id: "admin-1", role: Role.ADMIN },
      }),
    ).not.toThrow();
  });
});
