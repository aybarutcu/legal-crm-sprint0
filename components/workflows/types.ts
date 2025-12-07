import type { NotificationPolicy } from "@/lib/workflows/notification-policy";

export type WorkflowDependency = {
  id: string;
  sourceStepId: string;
  targetStepId: string;
  dependencyType: "DEPENDS_ON" | "TRIGGERS" | "IF_TRUE_BRANCH" | "IF_FALSE_BRANCH";
  dependencyLogic: "ALL" | "ANY" | "CUSTOM";
  conditionType?: "ALWAYS" | "IF_TRUE" | "IF_FALSE" | "SWITCH";
  conditionConfig?: Record<string, unknown>;
};

export type WorkflowStep = {
  id: string;
  title: string;
  actionType: string;
  roleScope: string;
  order?: number;
  required: boolean;
  actionConfig: Record<string, unknown>;
  // Dependency fields (P0.2)
  dependsOn?: string[];
  dependencyLogic?: "ALL" | "ANY" | "CUSTOM";
  // Canvas position fields (P0.3)
  positionX?: number;
  positionY?: number;
  notificationPolicies?: NotificationPolicy[];
};

export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string | null;
  version: number;
  isActive: boolean;
  steps: WorkflowStep[];
  dependencies?: WorkflowDependency[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    instances: number;
  };
};
