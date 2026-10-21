"use server";

import { getCurrentUserProfile } from "@/lib/user-profile";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  recordFeedConsumptionSchema,
  type RecordFeedConsumptionInput,
} from "@/lib/validations/feed-consumption";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ─── View Types ───────────────────────────────────────────────────────────────

export interface FeedConsumptionView {
  id: string;
  flock_id: string;
  feed_type: string;
  quantity_kg: number;
  consumption_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  flock?: {
    flock_identifier: string;
  } | null;
  creator?: {
    full_name: string | null;
  } | null;
}

export interface ActiveFlockOption {
  id: string;
  flock_identifier: string;
}

export interface AvailableFeedOption {
  feed_type: string;
  current_stock_kg: number;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getFeedConsumptionHistory(
  limit = 100
): Promise<ActionResult<FeedConsumptionView[]>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("feed_consumption")
      .select(`
        id,
        flock_id,
        feed_type,
        quantity_kg,
        consumption_date,
        notes,
        created_by,
        created_at,
        flock:flocks(flock_identifier),
        creator:profiles(full_name)
      `)
      .order("consumption_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as unknown as FeedConsumptionView[] };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to load feed consumption history.",
    };
  }
}

export async function getActiveFlocksForFeeding(): Promise<
  ActionResult<ActiveFlockOption[]>
> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("flocks")
      .select("id, flock_identifier")
      .eq("status", "ACTIVE")
      .order("flock_identifier", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as ActiveFlockOption[] };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to load active flocks.",
    };
  }
}

export async function getAvailableFeedTypes(): Promise<
  ActionResult<AvailableFeedOption[]>
> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("feed_inventory")
      .select("feed_type, current_stock_kg")
      .gt("current_stock_kg", 0)
      .order("feed_type", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as AvailableFeedOption[] };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to load available feed types.",
    };
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function recordFeedConsumption(
  input: RecordFeedConsumptionInput
): Promise<ActionResult<{ id: string }>> {
  const caller = await getCurrentUserProfile();

  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  if (caller.role !== "ADMIN" && caller.role !== "STAFF") {
    return {
      success: false,
      error: "Unauthorized: ADMIN or STAFF access required.",
    };
  }

  const parsed = recordFeedConsumptionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input parameters.",
    };
  }

  const { flock_id, feed_type, quantity_kg, consumption_date, notes } =
    parsed.data;

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("record_feed_consumption", {
      p_flock_id: flock_id,
      p_feed_type: feed_type,
      p_quantity_kg: quantity_kg,
      p_consumption_date: consumption_date,
      p_notes: notes || "",
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/feed-consumption");
    revalidatePath("/feed-inventory");
    revalidatePath("/dashboard");

    return { success: true, data: { id: data as string } };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to record feed consumption.",
    };
  }
}
