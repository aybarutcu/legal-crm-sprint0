export type ActionState =
  | "PENDING"
  | "READY"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "COMPLETED"
  | "FAILED"
  | "SKIPPED";

export type ActionType =
  | "CHECKLIST"
  | "APPROVAL_LAWYER"
  | "SIGNATURE_CLIENT"
  | "REQUEST_DOC_CLIENT"
  | "PAYMENT_CLIENT"
  | "WRITE_TEXT"
  | "POPULATE_QUESTIONNAIRE";

export type RoleScope = "ADMIN" | "LAWYER" | "PARALEGAL" | "CLIENT";

export type WorkflowInstanceStep = {
  id: string;
  order: number;
  title: string;
  actionType: ActionType;
  roleScope: RoleScope;
  required: boolean;
  actionState: ActionState;
  actionData: Record<string, unknown> | null;
  assignedToId: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type WorkflowInstance = {
  id: string;
  status: string;
  createdAt: string;
  createdBy: { name: string | null; email: string | null } | null;
  template: {
    name: string;
  };
  steps: WorkflowInstanceStep[];
};
