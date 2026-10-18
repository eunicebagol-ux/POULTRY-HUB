"use server";

import { getCurrentUserProfile } from "@/lib/user-profile";
import { createClient } from "@/lib/supabase/server";
import {
  createFlockSchema,
  updateFlockSchema,
  recordMortalitySchema,
  recordCullingSchema,
  BREED_EGG_COLOR_MAP,
  type CreateFlockInput,
  type UpdateFlockInput,
  type RecordMortalityInput,
  type RecordCullingInput,
} from "@/lib/validations/flocks";
import { revalidatePath } from "next/cache";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ── Create Flock ──────────────────────────────────────────────────────────────

/**
 * Creates a new flock batch.
 * Accessible to both ADMIN and STAFF.
 * created_by is derived server-side from the authenticated session.
 * current_bird_count is set equal to initial_bird_count on creation.
 */
export async function createFlock(
  input: CreateFlockInput
): Promise<ActionResult<{ id: string }>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  const parsed = createFlockSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input." };
  }

  const { flock_identifier, breed, acquisition_date, initial_bird_count, notes } = parsed.data;

  // Derive egg shell color from breed — not accepted from the client form.
  const egg_shell_color = BREED_EGG_COLOR_MAP[breed] ?? "Brown";

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("flocks")
      .insert({
        flock_identifier,
        breed: breed || null,
        egg_shell_color,
        acquisition_date,
        initial_bird_count,
        current_bird_count: initial_bird_count,
        status: "ACTIVE",
        notes: notes || null,
        created_by: caller.id,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: `Flock identifier "${flock_identifier}" already exists.` };
      }
      return { success: false, error: error.message };
    }

    revalidatePath("/flocks");
    return { success: true, data: { id: data.id } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create flock.",
    };
  }
}

// ── Update Flock ──────────────────────────────────────────────────────────────

/**
 * Updates flock metadata and status.
 * Accessible to both ADMIN and STAFF (per SKILL.md: active users can update flocks).
 * Does NOT modify bird counts — those are only changed via mortality/culling RPCs.
 */
export async function updateFlock(
  input: UpdateFlockInput
): Promise<ActionResult> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  const parsed = updateFlockSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input." };
  }

  const { id, flock_identifier, breed, acquisition_date, status, notes } = parsed.data;

  // Re-derive egg shell color from the (possibly updated) breed.
  // Falls back to the existing DB value if breed is not provided.
  const derivedEggColor = breed ? (BREED_EGG_COLOR_MAP[breed] ?? "Brown") : undefined;

  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("flocks")
      .update({
        flock_identifier,
        breed: breed || null,
        ...(derivedEggColor ? { egg_shell_color: derivedEggColor } : {}),
        acquisition_date,
        status,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      if (error.code === "23505") {
        return { success: false, error: `Flock identifier "${flock_identifier}" already exists.` };
      }
      return { success: false, error: error.message };
    }

    revalidatePath("/flocks");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update flock.",
    };
  }
}

// ── Record Mortality ──────────────────────────────────────────────────────────

/**
 * Records a flock mortality event via the record_flock_mortality() RPC.
 * The RPC is SECURITY DEFINER and enforces:
 *   - Active flock validation
 *   - Bird count integrity (no negative count)
 *   - Atomic bird count update
 *   - activity_logs entry
 * Accessible to ADMIN and STAFF.
 */
export async function recordMortality(
  input: RecordMortalityInput
): Promise<ActionResult<{ id: string }>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  const parsed = recordMortalitySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input." };
  }

  const { flock_id, quantity, event_date, reason } = parsed.data;

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("record_flock_mortality", {
      p_flock_id: flock_id,
      p_quantity: quantity,
      p_event_date: event_date,
      p_reason: reason || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/flocks");
    return { success: true, data: { id: data as string } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to record mortality.",
    };
  }
}

// ── Record Culling ────────────────────────────────────────────────────────────

/**
 * Records a flock culling event via the record_flock_culling() RPC.
 * Same integrity guarantees as recordMortality.
 * Accessible to ADMIN and STAFF.
 */
export async function recordCulling(
  input: RecordCullingInput
): Promise<ActionResult<{ id: string }>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  const parsed = recordCullingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input." };
  }

  const { flock_id, quantity, event_date, reason } = parsed.data;

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("record_flock_culling", {
      p_flock_id: flock_id,
      p_quantity: quantity,
      p_event_date: event_date,
      p_reason: reason || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/flocks");
    return { success: true, data: { id: data as string } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to record culling.",
    };
  }
}
