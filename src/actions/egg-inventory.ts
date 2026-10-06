"use server";

import { getCurrentUserProfile } from "@/lib/user-profile";
import { createClient } from "@/lib/supabase/server";
import {
  adjustEggInventorySchema,
  type AdjustEggInventoryInput,
} from "@/lib/validations/egg-inventory";
import { revalidatePath } from "next/cache";
import type { EggSize } from "@/types";
import type { EggTransactionType } from "@/types/database.types";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ─── View Types ───────────────────────────────────────────────────────────────

export interface EggInventoryRow {
  id: string;
  size: EggSize;
  stock_pieces: number;
  updated_at: string;
}

export interface EggInventoryTransactionRow {
  id: string;
  size: EggSize;
  quantity: number;
  transaction_type: EggTransactionType;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

// ─── Fetch inventory stock levels ────────────────────────────────────────────

/**
 * Fetches all egg_inventory rows ordered by size for display.
 * RLS: SELECT is permitted for all active users.
 */
export async function getEggInventory(): Promise<
  ActionResult<EggInventoryRow[]>
> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("egg_inventory")
      .select("id, size, stock_pieces, updated_at")
      .order("size");

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as EggInventoryRow[] };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to load egg inventory.",
    };
  }
}

// ─── Fetch transaction ledger ─────────────────────────────────────────────────

/**
 * Fetches recent egg_inventory_transactions ordered newest-first.
 * RLS: SELECT is permitted for all active users.
 */
export async function getEggInventoryTransactions(
  limit = 100
): Promise<ActionResult<EggInventoryTransactionRow[]>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("egg_inventory_transactions")
      .select(
        "id, size, quantity, transaction_type, reference_id, notes, created_by, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: (data ?? []) as EggInventoryTransactionRow[],
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to load inventory transactions.",
    };
  }
}

// ─── Adjust egg inventory (ADMIN only) ───────────────────────────────────────

/**
 * Calls the adjust_egg_inventory() SECURITY DEFINER RPC.
 *
 * RPC Guarantees:
 * - Enforces ADMIN-only access (raises exception if caller is not ADMIN).
 * - Locks egg_inventory row with SELECT ... FOR UPDATE.
 * - Validates resulting stock_pieces >= 0.
 * - Creates ADJUSTMENT or CORRECTION entry in egg_inventory_transactions.
 * - Updates egg_inventory.stock_pieces atomically.
 * - Requires non-empty reason (p_reason).
 * - Logs action in activity_logs.
 *
 * The Server Action performs application-layer validation (role check + Zod)
 * before handing off to the RPC, which is the authoritative enforcement layer.
 */
export async function adjustEggInventory(
  input: AdjustEggInventoryInput
): Promise<ActionResult<{ id: string }>> {
  // Application-layer auth check (defence-in-depth — RPC enforces ADMIN independently)
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }
  if (caller.role !== "ADMIN") {
    return {
      success: false,
      error: "Forbidden: only administrators can adjust egg inventory.",
    };
  }

  // Zod validation
  const parsed = adjustEggInventorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input parameters.",
    };
  }

  const { size, adjustment, reason } = parsed.data;

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("adjust_egg_inventory", {
      p_size: size,
      p_adjustment: adjustment,
      p_reason: reason,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/egg-inventory");
    revalidatePath("/dashboard");

    return { success: true, data: { id: data as string } };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to adjust egg inventory.",
    };
  }
}
