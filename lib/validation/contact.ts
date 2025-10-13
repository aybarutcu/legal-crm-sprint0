import { z } from "zod";

export const CONTACT_TYPES = ["LEAD", "CLIENT", "OTHER"] as const;
export const CONTACT_STATUS = [
  "NEW",
  "QUALIFIED",
  "DISQUALIFIED",
  "ACTIVE",
  "ARCHIVED",
] as const;

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional();

export const CONTACT_PAGE_SIZE = 50;

export const contactCreateSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: optionalString.pipe(z.string().email().optional()),
  phone: optionalString,
  company: optionalString,
  status: z.enum(CONTACT_STATUS).optional().default("NEW"),
  type: z.enum(CONTACT_TYPES).optional().default("LEAD"),
  source: optionalString,
  tags: z.array(z.string().min(1)).optional().default([]),
  ownerId: optionalString,
});

export const contactUpdateSchema = z
  .object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    email: optionalString.pipe(z.string().email().optional()),
    phone: z
      .union([z.string().trim(), z.null()])
      .optional()
      .transform((value) => (value === "" ? null : value ?? undefined)),
    company: z
      .union([z.string().trim(), z.null()])
      .optional()
      .transform((value) => (value === "" ? null : value ?? undefined)),
    status: z.enum(CONTACT_STATUS).optional(),
    type: z.enum(CONTACT_TYPES).optional(),
    source: z
      .union([z.string().trim(), z.null()])
      .optional()
      .transform((value) => (value === "" ? null : value ?? undefined)),
    tags: z.array(z.string().min(1)).optional(),
    ownerId: z
      .union([z.string().trim(), z.null()])
      .optional()
      .transform((value) => (value === "" ? null : value ?? undefined)),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const contactQuerySchema = z.object({
  q: optionalString,
  type: optionalString.pipe(z.enum(CONTACT_TYPES).optional()),
  status: optionalString.pipe(z.enum(CONTACT_STATUS).optional()),
  ownerId: optionalString,
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(CONTACT_PAGE_SIZE)
    .default(CONTACT_PAGE_SIZE),
});

export type ContactCreateInput = z.infer<typeof contactCreateSchema>;
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;
export type ContactQueryInput = z.infer<typeof contactQuerySchema>;
