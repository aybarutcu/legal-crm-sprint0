import { z } from "zod";

// Question Type Schema
export const questionTypeSchema = z.enum(["FREE_TEXT", "SINGLE_CHOICE", "MULTI_CHOICE"]);

// Response Status Schema
export const responseStatusSchema = z.enum(["IN_PROGRESS", "COMPLETED", "ABANDONED"]);

// Validation Rules Schema (for questions)
export const validationRulesSchema = z
  .object({
    minLength: z.number().int().min(0).optional(),
    maxLength: z.number().int().min(1).optional(),
    minChoices: z.number().int().min(1).optional(), // For MULTI_CHOICE
    maxChoices: z.number().int().min(1).optional(), // For MULTI_CHOICE
    pattern: z.string().optional(), // Regex pattern for validation
  })
  .optional();

// Question Schema (for creating/updating questions)
export const questionSchema = z.object({
  questionText: z.string().min(1, "Question text is required").max(1000),
  questionType: questionTypeSchema,
  order: z.number().int().min(0).default(0),
  required: z.boolean().default(true),
  placeholder: z.string().max(200).optional(),
  helpText: z.string().max(500).optional(),
  options: z.array(z.string().min(1).max(200)).optional(),
  validation: validationRulesSchema,
});

// Questionnaire Create Schema
export const questionnaireCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  questions: z.array(questionSchema).min(1, "At least one question is required"),
});

// Questionnaire Update Schema
export const questionnaireUpdateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200).optional(),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
  questions: z
    .array(
      questionSchema.extend({
        id: z.string().optional(), // Optional ID for updating existing questions
      })
    )
    .optional(),
});

// Question Update Schema (for updating individual questions)
export const questionUpdateSchema = questionSchema.partial().extend({
  id: z.string().cuid().optional(),
});

// Answer Schema (for submitting individual answers)
export const answerSchema = z.object({
  questionId: z.string().cuid(),
  answerText: z.string().optional(),
  answerJson: z.union([z.string(), z.array(z.string())]).optional(),
});

// Response Submit Schema (for completing a questionnaire)
export const responseSubmitSchema = z.object({
  answers: z.array(answerSchema).min(1, "At least one answer is required"),
});

// Response Create Schema (for starting a new response)
export const responseCreateSchema = z.object({
  questionnaireId: z.string().cuid(),
  workflowStepId: z.string().cuid().optional(),
  matterId: z.string().cuid().optional(),
});

// Response Update Schema (for updating response status)
export const responseUpdateSchema = z.object({
  status: responseStatusSchema.optional(),
  answers: z.array(answerSchema).optional(),
});

// Query Schemas (for filtering)
export const questionnaireQuerySchema = z.object({
  search: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === "true" ? true : val === "false" ? false : undefined)),
  createdById: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const responseQuerySchema = z.object({
  questionnaireId: z.string().cuid().optional(),
  matterId: z.string().cuid().optional(),
  respondentId: z.string().cuid().optional(),
  status: responseStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// Type Exports
export type QuestionType = z.infer<typeof questionTypeSchema>;
export type ResponseStatus = z.infer<typeof responseStatusSchema>;
export type ValidationRules = z.infer<typeof validationRulesSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
export type QuestionnaireCreateInput = z.infer<typeof questionnaireCreateSchema>;
export type QuestionnaireUpdateInput = z.infer<typeof questionnaireUpdateSchema>;
export type AnswerInput = z.infer<typeof answerSchema>;
export type ResponseSubmitInput = z.infer<typeof responseSubmitSchema>;
export type ResponseCreateInput = z.infer<typeof responseCreateSchema>;
export type ResponseUpdateInput = z.infer<typeof responseUpdateSchema>;
export type QuestionnaireQuery = z.infer<typeof questionnaireQuerySchema>;
export type ResponseQuery = z.infer<typeof responseQuerySchema>;
