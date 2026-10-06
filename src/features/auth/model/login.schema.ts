import { z } from "zod";
import { USER_ROLES, type UserRole } from "./roles";

const roleValues = Object.values(USER_ROLES);

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your User ID."),
  password: z.string().min(1, "Enter your password."),
  role: z
    .string()
    .min(1, "Select your role to continue.")
    .refine(
      (value) => roleValues.includes(value as UserRole),
      "Select your role to continue.",
    ),
});

export interface LoginFormValues {
  username: string;
  password: string;
  role: UserRole | "";
}
