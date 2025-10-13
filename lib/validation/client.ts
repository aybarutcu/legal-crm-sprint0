import { z } from "zod";

export const clientInviteSchema = z.object({
  email: z.string().email("Geçerli bir e-posta giriniz").transform((value) => value.toLowerCase().trim()),
  name: z
    .string()
    .min(1, "İsim gereklidir")
    .transform((value) => value.trim()),
});

export const clientActivationSchema = z.object({
  token: z
    .string()
    .min(1, "Token gereklidir")
    .max(512),
  password: z
    .string()
    .min(8, "Şifre en az 8 karakter olmalıdır")
    .max(128, "Şifre 128 karakterden uzun olmamalıdır"),
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
});

export const clientPasswordResetRequestSchema = z.object({
  email: z.string().email("Geçerli bir e-posta giriniz").transform((value) => value.toLowerCase().trim()),
});

export const clientPasswordResetConfirmSchema = z.object({
  token: z.string().min(1).max(512),
  password: z.string().min(8).max(128),
});
