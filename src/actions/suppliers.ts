"use server";

import { getCurrentUserProfile } from "@/lib/user-profile";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  createSupplierSchema,
  updateSupplierSchema,
  type CreateSupplierInput,
  type UpdateSupplierInput,
} from "@/lib/validations/suppliers";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export interface SupplierView {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getSuppliers(): Promise<ActionResult<SupplierView[]>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name, contact_person, phone, email, address, is_active, created_at, updated_at")
      .order("name", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as SupplierView[] };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load suppliers.",
    };
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createSupplier(
  input: CreateSupplierInput
): Promise<ActionResult<SupplierView>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  const parsed = createSupplierSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid supplier parameters.",
    };
  }

  const { name, contact_person, phone, email, address, is_active } = parsed.data;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        name,
        contact_person: contact_person?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        is_active: is_active ?? true,
      })
      .select("id, name, contact_person, phone, email, address, is_active, created_at, updated_at")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/suppliers");
    revalidatePath("/feed-inventory");
    revalidatePath("/expenses");
    revalidatePath("/dashboard");

    return { success: true, data: data as SupplierView };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create supplier.",
    };
  }
}

export async function updateSupplier(
  id: string,
  input: UpdateSupplierInput
): Promise<ActionResult<SupplierView>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  const parsed = updateSupplierSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid supplier update data.",
    };
  }

  const updatePayload: {
    name?: string;
    contact_person?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    is_active?: boolean;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name;
  if (parsed.data.contact_person !== undefined)
    updatePayload.contact_person = parsed.data.contact_person?.trim() || null;
  if (parsed.data.phone !== undefined)
    updatePayload.phone = parsed.data.phone?.trim() || null;
  if (parsed.data.email !== undefined)
    updatePayload.email = parsed.data.email?.trim() || null;
  if (parsed.data.address !== undefined)
    updatePayload.address = parsed.data.address?.trim() || null;
  if (parsed.data.is_active !== undefined)
    updatePayload.is_active = parsed.data.is_active;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("suppliers")
      .update(updatePayload)
      .eq("id", id)
      .select("id, name, contact_person, phone, email, address, is_active, created_at, updated_at")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/suppliers");
    revalidatePath("/feed-inventory");
    revalidatePath("/expenses");
    revalidatePath("/dashboard");

    return { success: true, data: data as SupplierView };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update supplier.",
    };
  }
}

export async function toggleSupplierStatus(
  id: string,
  is_active: boolean
): Promise<ActionResult<void>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("suppliers")
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/suppliers");
    revalidatePath("/feed-inventory");
    revalidatePath("/expenses");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to change supplier status.",
    };
  }
}

export async function deleteSupplier(id: string): Promise<ActionResult<void>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  if (caller.role !== "ADMIN") {
    return {
      success: false,
      error: "Unauthorized: ADMIN access required to delete suppliers.",
    };
  }

  try {
    const supabase = await createClient();

    // 1. Guard against historical expense records being severed:
    // Even though the foreign key has ON DELETE SET NULL, we must NOT orphan historical records.
    const { data: existingExpenses, error: checkError } = await supabase
      .from("expenses")
      .select("id")
      .eq("supplier_id", id)
      .limit(1);

    if (checkError) {
      return {
        success: false,
        error: "Failed to verify supplier expense history before deletion.",
      };
    }

    if (existingExpenses && existingExpenses.length > 0) {
      return {
        success: false,
        error:
          "Cannot delete this supplier because they are associated with historical expense records. Please deactivate the supplier instead to preserve financial audit history and cost attribution.",
      };
    }

    // 2. Perform delete via authenticated Supabase client (enforcing RLS suppliers_delete_admin_only)
    const { error } = await supabase.from("suppliers").delete().eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/suppliers");
    revalidatePath("/feed-inventory");
    revalidatePath("/expenses");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete supplier.",
    };
  }
}
