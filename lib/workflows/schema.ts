// lib/workflows/schema.ts
import { z } from "zod";

export const ActionType = z.enum([
  "APPROVAL",
  "SIGNATURE",
  "REQUEST_DOC",
  "PAYMENT",
  "TASK",
  "CHECKLIST",
  "WRITE_TEXT",
  "POPULATE_QUESTIONNAIRE",
  "AUTOMATION_EMAIL",
  "AUTOMATION_WEBHOOK",
]);
export const RoleScope = z.enum(["ADMIN","LAWYER","PARALEGAL","CLIENT"]);
export const NotificationChannel = z.enum(["EMAIL","SMS","PUSH"]);
export const NotificationTrigger = z.enum(["ON_READY","ON_COMPLETED","ON_FAILED"]);
export const NotificationSendStrategy = z.enum(["IMMEDIATE","DELAYED"]);

export const NotificationPolicy = z.object({
  id: z.string().optional(),
  channel: NotificationChannel,
  triggers: z.array(NotificationTrigger).nonempty().default(["ON_READY"]),
  recipients: z.array(z.string().min(1)).nonempty(),
  cc: z.array(z.string().min(1)).optional(),
  subjectTemplate: z.string().min(1).optional(),
  bodyTemplate: z.string().min(1).optional(),
  templateId: z.string().optional(),
  sendStrategy: NotificationSendStrategy.default("IMMEDIATE"),
  delayMinutes: z.number().int().positive().max(10080).optional().nullable(),
});

export const WorkflowDependency = z.object({
  id: z.string().optional(),
  sourceStepId: z.string().min(1),
  targetStepId: z.string().min(1),
  dependencyType: z.enum(["DEPENDS_ON", "TRIGGERS", "IF_TRUE_BRANCH", "IF_FALSE_BRANCH"]).default("DEPENDS_ON"),
  dependencyLogic: z.enum(["ALL", "ANY", "CUSTOM"]).default("ALL"),
  conditionType: z.enum(["ALWAYS", "IF_TRUE", "IF_FALSE", "SWITCH"]).optional(),
  conditionConfig: z.record(z.any()).optional(),
});

export const WorkflowTemplateStepDraft = z.object({
  id: z.string().min(1).optional(), // AI generates "step_0", "step_1", etc.
  order: z.number().int().nonnegative(),
  title: z.string().min(1),
  actionType: ActionType,
  roleScope: RoleScope,
  required: z.boolean().default(true),
  actionConfig: z.record(z.any()).default({}), // serbest JSON
  notificationPolicies: z.array(NotificationPolicy).default([]),
  positionX: z.number().optional(), // ReactFlow X coordinate
  positionY: z.number().optional(), // ReactFlow Y coordinate
});

export const WorkflowTemplateDraft = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().default(false),
  steps: z.array(WorkflowTemplateStepDraft).min(1),
  dependencies: z.array(WorkflowDependency).default([]),
});

export type TWorkflowTemplateDraft = z.infer<typeof WorkflowTemplateDraft>;
export type TNotificationPolicy = z.infer<typeof NotificationPolicy>;
export type TWorkflowDependency = z.infer<typeof WorkflowDependency>;
