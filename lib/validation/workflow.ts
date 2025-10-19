import { z } from "zod";

const cuidSchema = z.string().trim().min(1);

export const actionTypeSchema = z.enum([
  "APPROVAL_LAWYER",
  "SIGNATURE_CLIENT",
  "REQUEST_DOC_CLIENT",
  "PAYMENT_CLIENT",
  "TASK",
  "CHECKLIST",
  "WRITE_TEXT",
  "POPULATE_QUESTIONNAIRE",
]);

export const roleScopeSchema = z.enum(["ADMIN", "LAWYER", "PARALEGAL", "CLIENT"]);

// Condition schemas for workflow branching
export const conditionTypeSchema = z.enum(["ALWAYS", "IF_TRUE", "IF_FALSE", "SWITCH"]);

export const conditionOperatorSchema = z.enum([
  "==",
  "!=",
  ">",
  "<",
  ">=",
  "<=",
  "contains",
  "startsWith",
  "endsWith",
  "in",
  "notIn",
  "exists",
  "notExists",
  "isEmpty",
  "isNotEmpty",
]);

// Simple condition: single field comparison
const simpleConditionSchema = z.object({
  type: z.literal("simple"),
  field: z.string().trim().min(1, "Field path is required"),
  operator: conditionOperatorSchema,
  value: z.any().optional(), // Optional because exists/notExists/isEmpty don't need value
});

// Compound condition: multiple conditions with AND/OR logic
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const compoundConditionSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    type: z.literal("compound"),
    logic: z.enum(["AND", "OR"]),
    conditions: z
      .array(z.union([simpleConditionSchema, compoundConditionSchema]))
      .min(2, "Compound condition must have at least 2 sub-conditions"),
  })
);

// Union of all condition types
export const conditionConfigSchema = z.union([simpleConditionSchema, compoundConditionSchema]);

// Dependency logic enum
export const dependencyLogicSchema = z.enum(["ALL", "ANY", "CUSTOM"]);

const workflowStepSchema = z
  .object({
    title: z.string().trim().min(2, "Step title must be at least 2 characters"),
    actionType: actionTypeSchema,
    roleScope: roleScopeSchema,
    required: z.boolean().optional(),
    actionConfig: z
      .union([z.record(z.any()), z.array(z.any())])
      .optional()
      .default({}),
    order: z.coerce.number().int().min(0).optional(),
    // Conditional execution fields
    conditionType: conditionTypeSchema.optional(),
    conditionConfig: conditionConfigSchema.optional(),
    nextStepOnTrue: z.number().int().min(0).optional(),
    nextStepOnFalse: z.number().int().min(0).optional(),
    // Dependency fields (P0.2)
    dependsOn: z
      .array(z.number().int().min(0))
      .optional()
      .refine(
        (arr) => {
          if (!arr) return true;
          // Check for duplicates
          return new Set(arr).size === arr.length;
        },
        { message: "dependsOn cannot contain duplicate step orders" }
      ),
    dependencyLogic: dependencyLogicSchema.optional(),
  })
  .refine(
    (data) => {
      // If conditionType is IF_TRUE or IF_FALSE, conditionConfig must be provided
      if (
        (data.conditionType === "IF_TRUE" || data.conditionType === "IF_FALSE") &&
        !data.conditionConfig
      ) {
        return false;
      }
      return true;
    },
    {
      message: "conditionConfig is required when conditionType is IF_TRUE or IF_FALSE",
      path: ["conditionConfig"],
    }
  );

export const workflowTemplateCreateSchema = z
  .object({
    name: z.string().trim().min(2, "Workflow name must be at least 2 characters"),
    description: z.string().trim().optional(),
    steps: z.array(workflowStepSchema).min(1, "Workflow must have at least one step"),
  })
  .refine(
    (data) => {
      // Validate dependencies reference valid step orders
      const orders = new Set(data.steps.map((s, idx) => s.order ?? idx));
      for (const step of data.steps) {
        if (step.dependsOn) {
          for (const depOrder of step.dependsOn) {
            if (!orders.has(depOrder)) {
              return false;
            }
          }
        }
      }
      return true;
    },
    {
      message: "dependsOn contains invalid step order reference",
      path: ["steps"],
    }
  )
  .refine(
    (data) => {
      // Steps cannot depend on themselves
      for (const step of data.steps) {
        const stepOrder = step.order ?? data.steps.indexOf(step);
        if (step.dependsOn?.includes(stepOrder)) {
          return false;
        }
      }
      return true;
    },
    {
      message: "Step cannot depend on itself",
      path: ["steps"],
    }
  );

export const workflowTemplateUpdateSchema = z
  .object({
    name: z.string().trim().min(2).optional(),
    description: z.string().trim().optional().nullable(),
    steps: z.array(workflowStepSchema).min(1).optional(),
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
