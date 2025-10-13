import { z } from "zod";

const DEFAULT_REMINDER_MINUTES = Number.parseInt(
  process.env.CALENDAR_DEFAULT_REMINDER_MINUTES ?? "30",
  10,
);

export const eventAttendeeSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().optional(),
});

const eventCreateBodySchema = z.object({
  title: z.string().trim().min(2, "Event title must be at least 2 characters"),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  location: z.string().trim().optional(),
  description: z.string().trim().optional(),
  matterId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable(),
  attendees: z.array(eventAttendeeSchema).default([]),
  reminderMinutes: z
    .coerce
    .number()
    .int()
    .min(0)
    .max(1440)
    .default(DEFAULT_REMINDER_MINUTES),
  calendarId: z.string().trim().optional(),
});

export const eventCreateSchema = eventCreateBodySchema.superRefine((value, ctx) => {
  if (value.endAt <= value.startAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "endAt must be after startAt",
      path: ["endAt"],
    });
  }
});

const eventUpdateBodySchema = z.object({
  title: z.string().trim().min(2).optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
  location: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  matterId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable(),
  attendees: z.array(eventAttendeeSchema).optional(),
  reminderMinutes: z
    .coerce
    .number()
    .int()
    .min(0)
    .max(1440)
    .optional(),
  calendarId: z.string().trim().optional().nullable(),
});

export const eventUpdateSchema = eventUpdateBodySchema.superRefine((value, ctx) => {
  if (value.startAt && value.endAt && value.endAt <= value.startAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "endAt must be after startAt",
      path: ["endAt"],
    });
  }
});

export const eventQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  matterId: z.string().trim().min(1).optional(),
  attendee: z.string().trim().email().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  view: z.enum(["month", "week", "day"]).default("month"),
});

export const eventSyncSchema = z.object({
  force: z.boolean().optional(),
});

export type EventAttendeeInput = z.infer<typeof eventAttendeeSchema>;
export type EventCreateInput = z.infer<typeof eventCreateSchema>;
export type EventUpdateInput = z.infer<typeof eventUpdateSchema>;
export type EventQueryInput = z.infer<typeof eventQuerySchema>;
export type EventSyncInput = z.infer<typeof eventSyncSchema>;
