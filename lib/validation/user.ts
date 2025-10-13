import { z } from "zod";
import { Role } from "@prisma/client";

export const userUpdateSchema = z
  .object({
    role: z.nativeEnum(Role).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => typeof data.role !== "undefined" || typeof data.isActive !== "undefined", {
    message: "En az bir alan sağlanmalıdır.",
  });
