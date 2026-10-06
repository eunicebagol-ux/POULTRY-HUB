"use server";

import { getCurrentUserProfile } from "@/lib/user-profile";
import { createClient } from "@/lib/supabase/server";
import {
  recordEggProductionSchema,
  type RecordEggProductionInput,
} from "@/lib/validations/egg-production";
import { revalidatePath } from "next/cache";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

/**
 * Records daily egg collection via the authoritative record_egg_production() RPC.
 *
 * Database Authority Guarantees:
 * - Validates flock existence and ACTIVE status.
 * - Enforces total_eggs = good_eggs + damaged_eggs + cracked_eggs.
 * - Enforces sum(p_sizes) = good_eggs.
 * - Atomically inserts into public.egg_production and public.egg_production_sizes.
 * - Atomically increments public.egg_inventory.stock_pieces for intact sizes.
 * - Atomically appends transaction to public.egg_inventory_transactions.
 * - Atomically records event in public.activity_logs.
 * - Preserves unique constraint on (flock_id, production_date, collection_shift).
 *
 * Accessible to authenticated active ADMIN and STAFF accounts.
 */
export async function recordEggProduction(
  input: RecordEggProductionInput
): Promise<ActionResult<{ id: string }>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  const parsed = recordEggProductionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input parameters.",
    };
  }

  const {
    flock_id,
    production_date,
    collection_shift,
    sizes,
    damaged_eggs,
    cracked_eggs,
    notes,
  } = parsed.data;

  // Derive sums matching RPC invariants
  const good_eggs =
    sizes.SMALL +
    sizes.MEDIUM +
    sizes.LARGE +
    sizes.EXTRA_LARGE +
    sizes.JUMBO +
    sizes.UNGRADED;

  const total_eggs = good_eggs + damaged_eggs + cracked_eggs;

  // Format size breakdown array expected by PostgreSQL JSONB argument
  const p_sizes = Object.entries(sizes).map(([size, quantity]) => ({
    size,
    quantity,
  }));

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("record_egg_production", {
      p_flock_id: flock_id,
      p_production_date: production_date,
      p_collection_shift: collection_shift,
      p_total_eggs: total_eggs,
      p_good_eggs: good_eggs,
      p_damaged_eggs: damaged_eggs,
      p_cracked_eggs: cracked_eggs,
      p_notes: notes || "",
      p_sizes,
    });

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error: `A production collection record already exists for this flock on ${production_date} (${collection_shift.toLowerCase()} shift).`,
        };
      }
      return { success: false, error: error.message };
    }

    revalidatePath("/egg-production");
    revalidatePath("/dashboard");
    revalidatePath("/egg-inventory");

    return { success: true, data: { id: data as string } };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to record egg production.",
    };
  }
}
