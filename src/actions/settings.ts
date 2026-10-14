"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { updateSettingsSchema, type UpdateSettingsInput } from "@/lib/validations/settings";
import { revalidatePath } from "next/cache";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export async function updateSettings(
  input: UpdateSettingsInput
): Promise<ActionResult> {
  const caller = await getCurrentUserProfile();

  if (!caller || !caller.is_active || caller.role !== "ADMIN") {
    return {
      success: false,
      error: "Unauthorized: Only active administrators can modify settings.",
    };
  }

  const parsed = updateSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input parameters.",
    };
  }

  try {
    const supabase = await createClient();
    const settings = parsed.data;

    // We update each setting individually since they are separate rows.
    const updatePromises = Object.entries(settings).map(([key, value]) => {
      return supabase
        .from("system_settings")
        .update({
          setting_value: value,
          updated_by: caller.id,
          updated_at: new Date().toISOString(),
        })
        .eq("setting_key", key);
    });

    const results = await Promise.all(updatePromises);

    for (const result of results) {
      if (result.error) {
        throw new Error(`Failed to update setting: ${result.error.message}`);
      }
    }

    // Record audit log entry
    await supabase.from("activity_logs").insert({
      actor_id: caller.id,
      action: "SETTINGS_UPDATED",
      entity_table: "system_settings",
      entity_id: caller.id, // Using caller's ID since there is no single entity ID
      metadata: settings,
    });

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update settings.",
    };
  }
}
