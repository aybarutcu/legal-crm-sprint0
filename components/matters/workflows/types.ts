import type { NotificationPolicy } from "@/lib/workflows/notification-policy";
import type { WorkflowInstanceDependency } from "@prisma/client";

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
  | "APPROVAL"
  | "SIGNATURE"
  | "REQUEST_DOC"
  | "PAYMENT"
  | "WRITE_TEXT"
  | "POPULATE_QUESTIONNAIRE"
  | "TASK"
  | "AUTOMATION_EMAIL"
  | "AUTOMATION_WEBHOOK";

export type RoleScope = "ADMIN" | "LAWYER" | "PARALEGAL" | "CLIENT";

export type WorkflowInstanceStep = {
  id: string;
  title: string;
  actionType: ActionType;
  roleScope: RoleScope;
  required: boolean;
  actionState: ActionState;
  actionData: Record<string, unknown> | null;
  assignedToId: string | null;
  assignedTo?: { id: string; name: string | null; email: string | null } | null;
  dueDate: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | null;
  notes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  positionX?: number;
  positionY?: number;
  notificationPolicies?: NotificationPolicy[];
  automationLog?: unknown;
  notificationLog?: unknown;
};

export type WorkflowInstance = {
  id: string;
  status: string;
  createdAt: string;
  createdBy: { name: string | null; email: string | null } | null;
  template: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  templateVersion?: number;
  steps: WorkflowInstanceStep[];
  dependencies?: WorkflowInstanceDependency[];
};
