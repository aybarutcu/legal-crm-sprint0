import { z } from "zod";

const cuidSchema = z.string().trim().min(1);

export const actionTypeSchema = z.enum([
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

export const roleScopeSchema = z.enum(["ADMIN", "LAWYER", "PARALEGAL", "CLIENT"]);

// Dependency logic enum
export const dependencyLogicSchema = z.enum(["ALL", "ANY", "CUSTOM"]);

export const workflowDependencySchema = z.object({
  id: z.string().optional(),
  sourceStepId: z.string().trim().min(1),
  targetStepId: z.string().trim().min(1),
  dependencyType: z.enum(["DEPENDS_ON", "TRIGGERS", "IF_TRUE_BRANCH", "IF_FALSE_BRANCH"]).default("DEPENDS_ON"),
  dependencyLogic: dependencyLogicSchema.default("ALL"),
  conditionType: z.enum(["ALWAYS", "IF_TRUE", "IF_FALSE", "SWITCH"]).optional(),
  conditionConfig: z.record(z.any()).optional().nullable(),
});

export const notificationChannelSchema = z.enum(["EMAIL", "SMS", "PUSH"]);
export const notificationTriggerSchema = z.enum(["ON_READY", "ON_COMPLETED", "ON_FAILED"]);
export const notificationSendStrategySchema = z.enum(["IMMEDIATE", "DELAYED"]);

export const notificationPolicySchema = z.object({
  id: z.string().optional(),
  channel: notificationChannelSchema,
  triggers: z
    .array(notificationTriggerSchema)
    .nonempty("Notification policy must include at least one trigger")
    .default(["ON_READY"]),
  recipients: z
    .array(z.string().trim().min(1, "Recipient is required"))
    .nonempty("At least one recipient is required"),
  cc: z.array(z.string().trim().min(1)).optional(),
  subjectTemplate: z.string().trim().min(1).optional(),
  bodyTemplate: z.string().trim().min(1).optional(),
  templateId: z.string().trim().optional(),
  sendStrategy: notificationSendStrategySchema.default("IMMEDIATE"),
  delayMinutes: z.number().int().positive().max(10080).optional().nullable(),
});

const workflowStepSchema = z
  .object({
    id: z.string().trim().min(1, "Step ID is required").optional(),
    title: z.string().trim().min(2, "Step title must be at least 2 characters"),
    actionType: actionTypeSchema,
    roleScope: roleScopeSchema,
    required: z.boolean().optional(),
    actionConfig: z
      .union([z.record(z.any()), z.array(z.any())])
      .optional()
      .default({}),
    // Canvas position fields (P0.3)
    positionX: z.number().optional(),
    positionY: z.number().optional(),
    // Notification policies
    notificationPolicies: z.array(notificationPolicySchema).optional().default([]),
  });

export const workflowTemplateCreateSchema = z
  .object({
    name: z.string().trim().min(2, "Workflow name must be at least 2 characters"),
    description: z.string().trim().optional().nullable().default(""),
    steps: z.array(workflowStepSchema).min(1, "Workflow must have at least one step"),
    dependencies: z.array(workflowDependencySchema).default([]),
  })
  .refine(
    (data) => {
      // Validate dependencies reference valid step IDs
      const stepIds = new Set(data.steps.map((s) => s.id).filter(Boolean));
      for (const dep of data.dependencies) {
        if (!stepIds.has(dep.sourceStepId) || !stepIds.has(dep.targetStepId)) {
          return false;
        }
      }
      return true;
    },
    {
      message: "Dependencies contain invalid step ID references",
      path: ["dependencies"],
    }
  )
  .refine(
    (data) => {
      // Steps cannot depend on themselves
      for (const dep of data.dependencies) {
        if (dep.sourceStepId === dep.targetStepId) {
          return false;
        }
      }
      return true;
    },
    {
      message: "Step cannot depend on itself",
      path: ["dependencies"],
    }
  );

export const workflowTemplateUpdateSchema = z
  .object({
    name: z.string().trim().min(2).optional(),
    description: z.string().trim().optional().nullable(),
    isActive: z.boolean().optional(),
    steps: z.array(workflowStepSchema).min(1).optional(),
    dependencies: z.array(workflowDependencySchema).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided for update",
  });

export const workflowInstantiateSchema = z.object({
  matterId: cuidSchema,
});

export type WorkflowStepInput = z.infer<typeof workflowStepSchema>;
export type WorkflowTemplateCreateInput = z.infer<typeof workflowTemplateCreateSchema>;
export type WorkflowTemplateUpdateInput = z.infer<typeof workflowTemplateUpdateSchema>;
export type WorkflowInstantiateInput = z.infer<typeof workflowInstantiateSchema>;
export type NotificationPolicyInput = z.infer<typeof notificationPolicySchema>;
