"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { updateSettingsSchema, type UpdateSettingsInput } from "@/lib/validations/settings";
import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export interface OfficialGcashSettings {
  account_name: string | null;
  account_number: string | null;
}

/**
 * Public/Customer-safe accessor: Returns the farm's official GCash receiving details.
 * Does not expose sensitive secrets or internal metadata.
 */
export async function getOfficialGcashSettings(): Promise<
  ActionResult<OfficialGcashSettings>
> {
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("system_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["gcash_account_name", "gcash_account_number"]);

    if (error) {
      return { success: false, error: error.message };
    }

    let account_name: string | null = null;
    let account_number: string | null = null;

    data?.forEach((row) => {
      const val = row.setting_value;
      if (
        row.setting_key === "gcash_account_name" &&
        typeof val === "string" &&
        val.trim()
      ) {
        account_name = val.trim();
      }
      if (
        row.setting_key === "gcash_account_number" &&
        typeof val === "string" &&
        val.trim()
      ) {
        account_number = val.trim();
      }
    });

    return {
      success: true,
      data: {
        account_name,
        account_number,
      },
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to load GCash settings.",
    };
  }
}

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

    // We upsert each setting individually to support newly introduced settings keys
    const updatePromises = Object.entries(settings).map(([key, value]) => {
      return supabase
        .from("system_settings")
        .upsert(
          {
            setting_key: key,
            setting_value: value,
            updated_by: caller.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "setting_key" }
        );
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
    revalidatePath("/customer/order");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update settings.",
    };
  }
}
