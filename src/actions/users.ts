"use server";

import { getCurrentUserProfile } from "@/lib/user-profile";
import { createClient } from "@/lib/supabase/server";
import {
  updateUserRoleSchema,
  updateUserStatusSchema,
  type UpdateUserRoleInput,
  type UpdateUserStatusInput,
} from "@/lib/validations/users";
import { revalidatePath } from "next/cache";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

/**
 * Administrative action to update a user's role.
 *
 * Security Requirements:
 * 1. Caller must be authenticated, active, and have the ADMIN role in public.profiles.
 * 2. Role input is validated against Zod schema (only "ADMIN" or "STAFF").
 * 3. Cannot demote self if that would leave zero active admins.
 * 4. Audit trail entry is logged in public.activity_logs.
 */
export async function updateUserRole(
  input: UpdateUserRoleInput
): Promise<ActionResult> {
  const caller = await getCurrentUserProfile();

  if (!caller || !caller.is_active || caller.role !== "ADMIN") {
    return {
      success: false,
      error: "Unauthorized: Only active administrators can modify user roles.",
    };
  }

  const parsed = updateUserRoleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input parameters.",
    };
  }

  const { targetUserId, role: newRole } = parsed.data;

  try {
    const supabase = await createClient();

    // Fetch target user's current profile
    const { data: targetProfile, error: fetchError } = await supabase
      .from("profiles")
      .select("id, role, full_name, is_active")
      .eq("id", targetUserId)
      .single();

    if (fetchError || !targetProfile) {
      return { success: false, error: "Target user profile not found." };
    }

    if (targetProfile.role === newRole) {
      return { success: true };
    }

    // Guard: Prevent self-demotion if caller is demoting themselves
    if (caller.id === targetUserId && newRole !== "ADMIN") {
      // Check if other active admins exist
      const { count, error: countErr } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "ADMIN")
        .eq("is_active", true);

      if (countErr || (count !== null && count <= 1)) {
        return {
          success: false,
          error: "Cannot demote the only active administrator.",
        };
      }
    }

    // Update role
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        role: newRole,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetUserId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Record audit log entry
    await supabase.from("activity_logs").insert({
      actor_id: caller.id,
      action: "USER_ROLE_CHANGED",
      entity_table: "profiles",
      entity_id: targetUserId,
      metadata: {
        previous_role: targetProfile.role,
        new_role: newRole,
        target_name: targetProfile.full_name,
      },
    });

    revalidatePath("/users");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update user role.",
    };
  }
}

/**
 * Administrative action to activate or deactivate a user account.
 *
 * Security Requirements:
 * 1. Caller must be authenticated, active, and have the ADMIN role in public.profiles.
 * 2. Status input is validated against Zod schema.
 * 3. Administrator cannot deactivate their own active account.
 * 4. Audit trail entry is logged in public.activity_logs.
 */
export async function updateUserStatus(
  input: UpdateUserStatusInput
): Promise<ActionResult> {
  const caller = await getCurrentUserProfile();

  if (!caller || !caller.is_active || caller.role !== "ADMIN") {
    return {
      success: false,
      error: "Unauthorized: Only active administrators can modify account status.",
    };
  }

  const parsed = updateUserStatusSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input parameters.",
    };
  }

  const { targetUserId, isActive: newStatus } = parsed.data;

  // Guard: Admin cannot deactivate their own account
  if (caller.id === targetUserId && !newStatus) {
    return {
      success: false,
      error: "You cannot deactivate your own administrative account.",
    };
  }

  try {
    const supabase = await createClient();

    // Fetch target user's current profile
    const { data: targetProfile, error: fetchError } = await supabase
      .from("profiles")
      .select("id, role, full_name, is_active")
      .eq("id", targetUserId)
      .single();

    if (fetchError || !targetProfile) {
      return { success: false, error: "Target user profile not found." };
    }

    if (targetProfile.is_active === newStatus) {
      return { success: true };
    }

    // Update active status
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        is_active: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetUserId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Record audit log entry
    await supabase.from("activity_logs").insert({
      actor_id: caller.id,
      action: "USER_STATUS_CHANGED",
      entity_table: "profiles",
      entity_id: targetUserId,
      metadata: {
        previous_status: targetProfile.is_active,
        new_status: newStatus,
        target_name: targetProfile.full_name,
      },
    });

    revalidatePath("/users");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update user status.",
    };
  }
}
