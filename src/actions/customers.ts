"use server";

import { getCurrentUserProfile } from "@/lib/user-profile";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  createCustomerSchema,
  updateCustomerSchema,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from "@/lib/validations/customers";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export interface CustomerView {
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

export async function getCustomers(): Promise<ActionResult<CustomerView[]>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, contact_person, phone, email, address, is_active, created_at, updated_at")
      .order("name", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as CustomerView[] };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load customers.",
    };
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createCustomer(
  input: CreateCustomerInput
): Promise<ActionResult<CustomerView>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  const parsed = createCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid customer parameters.",
    };
  }

  const { name, contact_person, phone, email, address, is_active } = parsed.data;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("customers")
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

    revalidatePath("/customers");
    revalidatePath("/egg-sales");
    revalidatePath("/dashboard");

    return { success: true, data: data as CustomerView };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create customer.",
    };
  }
}

export async function updateCustomer(
  id: string,
  input: UpdateCustomerInput
): Promise<ActionResult<CustomerView>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  const parsed = updateCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid customer update data.",
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
      .from("customers")
      .update(updatePayload)
      .eq("id", id)
      .select("id, name, contact_person, phone, email, address, is_active, created_at, updated_at")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/customers");
    revalidatePath("/egg-sales");
    revalidatePath("/dashboard");

    return { success: true, data: data as CustomerView };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update customer.",
    };
  }
}

export async function toggleCustomerStatus(
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
      .from("customers")
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/customers");
    revalidatePath("/egg-sales");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to change customer status.",
    };
  }
}

export async function deleteCustomer(id: string): Promise<ActionResult<void>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  if (caller.role !== "ADMIN") {
    return { success: false, error: "Unauthorized: ADMIN access required to delete customers." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("customers").delete().eq("id", id);

    if (error) {
      if (error.code === "23503") {
        return {
          success: false,
          error:
            "Cannot delete this customer because they have existing sales records. Please deactivate the customer instead to preserve transaction history.",
        };
      }
      return { success: false, error: error.message };
    }

    revalidatePath("/customers");
    revalidatePath("/egg-sales");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete customer.",
    };
  }
}
