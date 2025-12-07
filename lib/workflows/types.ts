import type {
  ActionState,
  ActionType,
  Role,
  WorkflowInstance,
  WorkflowInstanceStep,
  WorkflowTemplateStep,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import type { NotificationPolicy } from "./notification-policy";

export type WorkflowActor = {
  id: string;
  role: Role;
};

export type WorkflowInstanceStepWithTemplate = WorkflowInstanceStep & {
  instance: WorkflowInstance;
  templateStep?: Pick<WorkflowTemplateStep, "actionConfig" | "roleScope" | "actionType" | "required" | "notificationPolicies"> | null;
  notificationPolicies?: NotificationPolicy[];
};

export type WorkflowRuntimeContext<TConfig = unknown, TData = unknown> = {
  tx: PrismaClient | Prisma.TransactionClient;
  instance: WorkflowInstance;
  step: WorkflowInstanceStepWithTemplate;
  actor?: WorkflowActor;
  config: TConfig;
  data: TData;
  now: Date;
  context: Record<string, unknown>; // Shared workflow context
  
  // Method to update workflow context (persisted to instance)
  updateContext: (updates: Record<string, unknown>) => void;
  
  // Internal: Get pending context updates (for runtime use)
  _getContextUpdates?: () => Record<string, unknown>;
};

export type ActionEvent = {
  type: string;
  payload?: unknown;
};

export interface IActionHandler<TConfig = unknown, TData = unknown> {
  type: ActionType;
  validateConfig(config: TConfig): void;
  canStart(ctx: WorkflowRuntimeContext<TConfig, TData>): boolean;
  start(ctx: WorkflowRuntimeContext<TConfig, TData>): Promise<ActionState | void>;
  complete(ctx: WorkflowRuntimeContext<TConfig, TData>, payload?: unknown): Promise<ActionState | void>;
  fail(ctx: WorkflowRuntimeContext<TConfig, TData>, reason: string): Promise<ActionState | void>;
  getNextStateOnEvent(ctx: WorkflowRuntimeContext<TConfig, TData>, event: ActionEvent): ActionState | null;
}

export type WorkflowActorSnapshot = {
  admins: string[];
  lawyers: string[];
  paralegals: string[];
  clients: string[];
};

export type EligibleActorResolution = {
  step: WorkflowInstanceStepWithTemplate;
  instance: WorkflowInstance;
  snapshot: WorkflowActorSnapshot;
};

export type ActionPermissionContext = {
  actor: WorkflowActor;
  step: WorkflowInstanceStepWithTemplate;
  snapshot: WorkflowActorSnapshot;
};

export type ActionPermissionCheck = {
  canPerform: boolean;
  reason?: string;
};

export type WorkflowActionGuardOptions = {
  actor?: WorkflowActor;
  allowAdminOverride?: boolean;
};

export type WorkflowStateTransitionOptions = WorkflowActionGuardOptions & {
  reason?: string;
};

export type ActionConfigParser<TConfig> = (raw: unknown) => TConfig;

export type ActionDataParser<TData> = (raw: unknown) => TData;
