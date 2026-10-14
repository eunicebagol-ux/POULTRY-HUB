"use server";

import { getCurrentUserProfile } from "@/lib/user-profile";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  receiveFeedStockSchema,
  type ReceiveFeedStockInput,
} from "@/lib/validations/feed-inventory";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ─── View Types ───────────────────────────────────────────────────────────────

export interface FeedInventoryView {
  id: string;
  feed_type: string;
  current_stock_kg: number;
  cost_per_kg: number;
  updated_at: string;
}

export interface FeedTransactionView {
  id: string;
  feed_type: string;
  quantity_kg: number;
  transaction_type: string;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  creator?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

export interface SupplierOption {
  id: string;
  name: string;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getFeedInventory(): Promise<ActionResult<FeedInventoryView[]>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("feed_inventory")
      .select("id, feed_type, current_stock_kg, cost_per_kg, updated_at")
      .order("feed_type", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as FeedInventoryView[] };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load feed inventory.",
    };
  }
}

export async function getFeedTransactions(limit = 100): Promise<ActionResult<FeedTransactionView[]>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("feed_inventory_transactions")
      .select(`
        id,
        feed_type,
        quantity_kg,
        transaction_type,
        reference_id,
        notes,
        created_by,
        created_at,
        creator:profiles(first_name, last_name)
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as FeedTransactionView[] };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load feed transactions.",
    };
  }
}

export async function getActiveSuppliers(): Promise<ActionResult<SupplierOption[]>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as SupplierOption[] };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load suppliers.",
    };
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function receiveFeedStock(
  input: ReceiveFeedStockInput
): Promise<ActionResult<{ id: string }>> {
  const caller = await getCurrentUserProfile();
  
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }
  
  if (caller.role !== "ADMIN") {
    return { success: false, error: "Unauthorized: ADMIN access required." };
  }

  const parsed = receiveFeedStockSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input parameters.",
    };
  }

  const { feed_type, quantity_kg, cost_per_kg, supplier_id, intake_date, notes } =
    parsed.data;

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("record_feed_stock_intake", {
      p_feed_type: feed_type,
      p_quantity_kg: quantity_kg,
      p_cost_per_kg: cost_per_kg,
      p_supplier_id: (supplier_id || null) as unknown as string,
      p_intake_date: intake_date,
      p_notes: notes || "",
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/feed-inventory");
    revalidatePath("/dashboard");
    revalidatePath("/expenses");

    return { success: true, data: { id: data as string } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to receive feed stock.",
    };
  }
}
