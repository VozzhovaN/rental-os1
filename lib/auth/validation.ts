import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/constants";

export const loginSchema = z
  .object({
    email: z.string().email().max(320),
    password: z.string().min(1).max(256),
  })
  .strict();

export const bootstrapPasswordSchema = z.string().min(MIN_PASSWORD_LENGTH).max(256);

export type LoginInput = z.infer<typeof loginSchema>;
