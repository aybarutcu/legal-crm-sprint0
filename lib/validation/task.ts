import { TaskPriority, TaskStatus } from "@prisma/client";
import { z } from "zod";

const cuidSchema = z.string().trim().min(1);

const titleSchema = z
  .string()
  .trim()
  .min(2, "Task title must be at least 2 characters");

export const taskCreateSchema = z.object({
  title: titleSchema,
  description: z.string().trim().min(1).optional(),
  matterId: cuidSchema.optional().nullable(),
  assigneeId: cuidSchema.optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.OPEN),
});

export const taskUpdateSchema = z
  .object({
    title: titleSchema.optional(),
    description: z.string().trim().optional().nullable(),
    matterId: cuidSchema.optional().nullable(),
    assigneeId: cuidSchema.optional().nullable(),
    dueAt: z.coerce.date().optional().nullable(),
    priority: z.nativeEnum(TaskPriority).optional(),
    status: z.nativeEnum(TaskStatus).optional(),
  })
  .refine(
    (data) =>
      !("dueAt" in data) || data.dueAt === null || data.dueAt instanceof Date,
    {
      message: "dueAt must be a valid date or null",
      path: ["dueAt"],
    },
  );

export const taskQuerySchema = z
  .object({
    q: z.string().trim().min(1).optional(),
    matterId: cuidSchema.optional(),
    assigneeId: cuidSchema.optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    dueFrom: z.coerce.date().optional(),
    dueTo: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  })
  .superRefine((value, ctx) => {
    if (value.dueFrom && value.dueTo && value.dueTo < value.dueFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "dueTo must be greater than or equal to dueFrom",
        path: ["dueTo"],
      });
    }
  });

export const taskChecklistCreateSchema = z.object({
  title: z.string().trim().min(1),
});

export const taskChecklistUpdateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  done: z.boolean().optional(),
  order: z.coerce.number().int().min(0).optional(),
});

export const taskLinkCreateSchema = z
  .object({
    documentId: cuidSchema.optional(),
    eventId: cuidSchema.optional(),
    url: z.string().trim().url("Must be a valid URL").optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.documentId && !value.eventId && !value.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one of documentId, eventId or url is required",
        path: ["documentId"],
      });
    }

    if (value.documentId && value.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use either documentId/eventId or url, not both",
        path: ["url"],
      });
    }
  });

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
export type TaskQueryInput = z.infer<typeof taskQuerySchema>;
export type TaskChecklistCreateInput = z.infer<typeof taskChecklistCreateSchema>;
export type TaskChecklistUpdateInput = z.infer<typeof taskChecklistUpdateSchema>;
export type TaskLinkCreateInput = z.infer<typeof taskLinkCreateSchema>;
