export type WorkflowStep = {
  id?: string;
  title: string;
  actionType: string;
  roleScope: string;
  required: boolean;
  actionConfig: Record<string, unknown>;
  order: number;
  // Conditional execution fields
  conditionType?: "ALWAYS" | "IF_TRUE" | "IF_FALSE" | "SWITCH";
  conditionConfig?: Record<string, unknown> | null;
  nextStepOnTrue?: number | null;
  nextStepOnFalse?: number | null;
};

export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string | null;
  version: number;
  isActive: boolean;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
};
