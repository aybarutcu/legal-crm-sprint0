import { z } from "zod";

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const MAX_UPLOAD_BYTES = parseInt(process.env.MAX_UPLOAD_BYTES ?? `${100 * 1024 * 1024}`, 10);

const isImageMime = (mime: string) => mime.startsWith("image/");

const mimeSchema = z
  .string()
  .refine((mime) => ALLOWED_MIME_TYPES.includes(mime) || isImageMime(mime), {
    message: "Unsupported MIME type",
  });

export const documentUploadSchema = z
  .object({
    filename: z.string().min(1),
    displayName: z.string().min(1).optional(),
    mime: mimeSchema,
    size: z.number().int().positive(),
    matterId: z.string().min(1).optional(),
    contactId: z.string().min(1).optional(),
    folderId: z.string().min(1).optional(),
    parentDocumentId: z.string().min(1).optional(),
  });

export const documentCreateSchema = z
  .object({
    documentId: z.string().min(1),
    filename: z.string().min(1),
    displayName: z.string().min(1).optional(),
    mime: mimeSchema,
    size: z.number().int().positive(),
    storageKey: z.string().min(1),
    version: z.number().int().positive().optional(),
    parentDocumentId: z.string().min(1).optional(),
    matterId: z.string().min(1).optional(),
    contactId: z.string().min(1).optional(),
    folderId: z.string().min(1).optional(),
    workflowStepId: z.string().min(1).optional(),
    tags: z.array(z.string().min(1)).optional(),
    accessScope: z.enum(["PUBLIC", "ROLE_BASED", "USER_BASED", "PRIVATE"]).optional(),
    accessMetadata: z.record(z.unknown()).optional(),
  });

export const documentQuerySchema = z.object({
  q: z.string().optional(),
  matterId: z.string().optional(),
  contactId: z.string().optional(),
  folderId: z.string().optional(),
  uploaderId: z.string().optional(),
  tags: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});
