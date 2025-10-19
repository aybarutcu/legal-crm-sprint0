// lib/workflows/schema.ts
import { z } from "zod";

export const ActionType = z.enum([
  "APPROVAL_LAWYER",
  "SIGNATURE_CLIENT",
  "REQUEST_DOC_CLIENT",
  "PAYMENT_CLIENT",
  "TASK",
  "CHECKLIST",
  "WRITE_TEXT",
  "POPULATE_QUESTIONNAIRE",
]);
export const RoleScope = z.enum(["ADMIN","LAWYER","PARALEGAL","CLIENT"]);

export const WorkflowTemplateStepDraft = z.object({
  order: z.number().int().nonnegative(),
  title: z.string().min(1),
  actionType: ActionType,
  roleScope: RoleScope,
  required: z.boolean().default(true),
  actionConfig: z.record(z.any()).default({}), // serbest JSON
});

export const WorkflowTemplateDraft = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().default(false),
  steps: z.array(WorkflowTemplateStepDraft).min(1),
});

export type TWorkflowTemplateDraft = z.infer<typeof WorkflowTemplateDraft>;