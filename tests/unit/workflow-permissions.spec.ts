import { describe, expect, it } from "vitest";
import { ActionState, ActionType, Role, RoleScope } from "@prisma/client";
import { canPerformAction } from "@/lib/workflows/permissions";

const baseStep = {
  id: "step-1",
  instanceId: "instance-1",
  templateStepId: null,
  order: 0,
  title: "Approval",
  actionType: ActionType.APPROVAL_LAWYER,
  roleScope: RoleScope.LAWYER,
  required: true,
  actionState: ActionState.READY,
  actionData: null,
  assignedToId: null,
  startedAt: null,
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const snapshot = {
  admins: ["admin-1"],
  lawyers: ["lawyer-1", "lawyer-2"],
  paralegals: ["paralegal-1"],
  clients: ["client-1"],
};

describe("workflow permissions", () => {
  it("allows admin override", () => {
    const result = canPerformAction({
      actor: { id: "admin-1", role: Role.ADMIN },
      step: baseStep,
      snapshot,
    });
    expect(result.canPerform).toBe(true);
  });

  it("allows eligible lawyer", () => {
    const result = canPerformAction({
      actor: { id: "lawyer-2", role: Role.LAWYER },
      step: baseStep,
      snapshot,
    });
    expect(result.canPerform).toBe(true);
  });

  it("rejects paralegal for lawyer scope", () => {
    const result = canPerformAction({
      actor: { id: "paralegal-1", role: Role.PARALEGAL },
      step: baseStep,
      snapshot,
    });
    expect(result.canPerform).toBe(false);
  });
});
