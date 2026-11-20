import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your User ID."),
  password: z.string().min(1, "Enter your password."),
  role: z
    .string()
    .min(1, "Select your role to continue."),
});

export interface LoginFormValues {
  username: string;
  password: string;
  role: string;
}
