import { z } from "zod";

const cuidSchema = z.string().trim().min(1);

export const actionTypeSchema = z.enum([
  "APPROVAL_LAWYER",
  "SIGNATURE_CLIENT",
  "REQUEST_DOC_CLIENT",
  "PAYMENT_CLIENT",
  "CHECKLIST",
]);

export const roleScopeSchema = z.enum(["ADMIN", "LAWYER", "PARALEGAL", "CLIENT"]);

const workflowStepSchema = z.object({
  title: z.string().trim().min(2, "Step title must be at least 2 characters"),
  actionType: actionTypeSchema,
  roleScope: roleScopeSchema,
  required: z.boolean().optional(),
  actionConfig: z
    .union([z.record(z.any()), z.array(z.any())])
    .optional()
    .default({}),
  order: z.coerce.number().int().min(0).optional(),
});

export const workflowTemplateCreateSchema = z.object({
  name: z.string().trim().min(2, "Workflow name must be at least 2 characters"),
  description: z.string().trim().optional(),
  steps: z.array(workflowStepSchema).min(1, "Workflow must have at least one step"),
});

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
