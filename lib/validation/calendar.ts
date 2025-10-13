import { z } from "zod";

export const calendarSyncSchema = z.object({
  calendarId: z.string().trim().min(1).optional(),
  forceFull: z.boolean().optional(),
});

export type CalendarSyncInput = z.infer<typeof calendarSyncSchema>;

export const calendarUpdateSchema = z.object({
  defaultReminderMinutes: z
    .coerce
    .number()
    .int()
    .min(0)
    .max(1440)
    .optional(),
  isPrimary: z.boolean().optional(),
});

export type CalendarUpdateInput = z.infer<typeof calendarUpdateSchema>;
