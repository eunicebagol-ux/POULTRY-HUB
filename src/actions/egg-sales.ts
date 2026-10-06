"use server";

import { getCurrentUserProfile } from "@/lib/user-profile";
import { createClient } from "@/lib/supabase/server";
import {
  recordEggSaleSchema,
  createCustomerSchema,
  type RecordEggSaleInput,
  type CreateCustomerInput,
} from "@/lib/validations/egg-sales";
import { revalidatePath } from "next/cache";
import type { EggSize, PackagingType } from "@/types";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ─── View Types ───────────────────────────────────────────────────────────────

export interface CustomerOption {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
}

export interface EggSaleItemView {
  id: string;
  size: EggSize;
  packaging: PackagingType;
  package_quantity: number;
  total_pieces: number;
  unit_price: number;
  line_total: number;
}

export interface EggSaleView {
  id: string;
  invoice_number: string | null;
  customer_id: string | null;
  sale_date: string;
  subtotal: number;
  discount: number;
  total_amount: number;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  customer: {
    id: string;
    name: string;
    contact_person: string | null;
    phone: string | null;
  } | null;
  items: EggSaleItemView[];
}

export interface EggStockLevel {
  size: EggSize;
  stock_pieces: number;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Fetches recent egg sales with joined customer details and line items.
 * RLS: SELECT is permitted for all active users.
 */
export async function getEggSales(limit = 100): Promise<ActionResult<EggSaleView[]>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("egg_sales")
      .select(`
        id,
        invoice_number,
        customer_id,
        sale_date,
        subtotal,
        discount,
        total_amount,
        status,
        notes,
        created_by,
        created_at,
        customer:customers(id, name, contact_person, phone),
        items:egg_sale_items(id, size, packaging, package_quantity, total_pieces, unit_price, line_total)
      `)
      .order("sale_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as unknown as EggSaleView[] };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load egg sales.",
    };
  }
}

/**
 * Fetches active customer directory records for sale selection.
 * RLS: SELECT is permitted for all active users.
 */
export async function getActiveCustomers(): Promise<ActionResult<CustomerOption[]>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, contact_person, phone, email, address, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as CustomerOption[] };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load customers.",
    };
  }
}

/**
 * Fetches current egg inventory balances for informational display in the sales form.
 * RLS: SELECT is permitted for all active users.
 */
export async function getEggInventoryStock(): Promise<ActionResult<EggStockLevel[]>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("egg_inventory")
      .select("size, stock_pieces")
      .order("size", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as EggStockLevel[] };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load egg inventory.",
    };
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Records an egg sale atomically via the record_egg_sale() PostgreSQL RPC.
 *
 * PostgreSQL Authority Guarantees:
 * - Locks relevant egg_inventory rows with FOR UPDATE to prevent race conditions.
 * - Authoritatively validates sufficient stock for every line item.
 * - Authoritatively calculates line totals, total pieces, subtotal, and total amount.
 * - Inserts header record into egg_sales (status: 'COMPLETED').
 * - Inserts line items into egg_sale_items.
 * - Decrements egg_inventory.stock_pieces atomically.
 * - Appends SALE entries (negative quantity) into egg_inventory_transactions ledger.
 * - Logs activity in activity_logs with customer ID and total amount.
 * - Enforces transactional rollback if any validation or stock check fails.
 *
 * Accessible to authenticated active ADMIN and STAFF accounts.
 */
export async function recordEggSale(
  input: RecordEggSaleInput
): Promise<ActionResult<{ id: string }>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  const parsed = recordEggSaleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input parameters.",
    };
  }

  const { customer_id, sale_date, invoice_number, discount, notes, items } =
    parsed.data;

  // Format line items payload matching RPC expectation:
  // [{ size, packaging, package_quantity, unit_price }]
  const p_items = items.map((item) => ({
    size: item.size,
    packaging: item.packaging,
    package_quantity: item.package_quantity,
    unit_price: item.unit_price,
  }));

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("record_egg_sale", {
      p_customer_id: customer_id,
      p_sale_date: sale_date,
      p_invoice_number: invoice_number?.trim() || "",
      p_discount: discount,
      p_notes: notes?.trim() || "",
      p_items,
    });

    if (error) {
      // Friendly formatting for known PostgreSQL check/domain exceptions
      if (error.message.includes("Insufficient stock")) {
        return {
          success: false,
          error: error.message,
        };
      }
      if (error.message.includes("Discount") && error.message.includes("cannot exceed subtotal")) {
        return {
          success: false,
          error: "Discount cannot exceed the sale subtotal.",
        };
      }
      if (error.message.includes("Customer") && error.message.includes("does not exist")) {
        return {
          success: false,
          error: "Selected customer does not exist or is inactive.",
        };
      }
      return { success: false, error: error.message };
    }

    revalidatePath("/egg-sales");
    revalidatePath("/egg-inventory");
    revalidatePath("/dashboard");

    return { success: true, data: { id: data as string } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to record egg sale.",
    };
  }
}

/**
 * Creates a new customer business directory record.
 * RLS: INSERT is permitted for all active users.
 */
export async function createCustomer(
  input: CreateCustomerInput
): Promise<ActionResult<CustomerOption>> {
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

  const { name, contact_person, phone, email, address } = parsed.data;

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
        is_active: true,
      })
      .select("id, name, contact_person, phone, email, address, is_active")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/egg-sales");
    revalidatePath("/customers");

    return { success: true, data: data as CustomerOption };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create customer.",
    };
  }
}
