import { z } from "zod";

export const updateUserRoleSchema = z.object({
  targetUserId: z.string().min(1, "User ID is required"),
  role: z.enum(["ADMIN", "STAFF"], {
    message: "Role must be either ADMIN or STAFF",
  }),
});

export const updateUserStatusSchema = z.object({
  targetUserId: z.string().min(1, "User ID is required"),
  isActive: z.boolean({
    message: "Active status is required",
  }),
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
