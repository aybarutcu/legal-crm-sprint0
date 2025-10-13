import { z } from "zod";

export const MATTER_STATUS = ["OPEN", "IN_PROGRESS", "ON_HOLD", "CLOSED"] as const;
export const MATTER_TYPES = [
  "CIVIL",
  "CRIMINAL",
  "COMMERCIAL",
  "FAMILY",
  "ADMINISTRATIVE",
  "OTHER",
] as const;

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional();

export const matterQuerySchema = z.object({
  q: optionalString,
  status: optionalString.pipe(z.enum(MATTER_STATUS).optional()),
  type: optionalString.pipe(z.enum(MATTER_TYPES).optional()),
  clientId: optionalString,
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

export const matterCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.enum(MATTER_TYPES),
  status: z.enum(MATTER_STATUS).optional().default("OPEN"),
  clientId: z.string().min(1, "Client is required"),
  ownerId: optionalString,
  jurisdiction: optionalString,
  court: optionalString,
  openedAt: z.coerce.date().optional(),
  nextHearingAt: z.coerce.date().optional(),
});

export const matterUpdateSchema = z
  .object({
    title: z.string().min(1).optional(),
    type: z.enum(MATTER_TYPES).optional(),
    status: z.enum(MATTER_STATUS).optional(),
    jurisdiction: optionalString,
    court: optionalString,
    openedAt: z.coerce.date().optional(),
    nextHearingAt: z.coerce.date().optional().nullable(),
    ownerId: optionalString,
    clientId: optionalString,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const matterPartyCreateSchema = z.object({
  contactId: z.string().min(1),
  role: z.enum(["PLAINTIFF", "DEFENDANT", "WITNESS", "OPPOSING_COUNSEL"]),
});
