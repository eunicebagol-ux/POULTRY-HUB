"use server";

/**
 * POULTRY HUB — Customer Orders Server Actions
 *
 * SECURITY CONTRACT:
 *   1. customer_id is ALWAYS resolved server-side via getCurrentUserProfile()
 *      + Supabase customers.clerk_user_id lookup. Never trust client input.
 *   2. Prices, totals, and inventory are NEVER computed or trusted from client.
 *   3. Status transitions beyond PENDING are STAFF/ADMIN only.
 *   4. Customers can only read their own orders (enforced by RLS + application layer).
 *   5. Submission does NOT touch egg_inventory or egg_sales tables.
 *
 * MIGRATION DEPENDENCY:
 *   These actions require Migration 014 (customer_orders, customer_order_items,
 *   egg_price_catalog) AND Migration 012 (CUSTOMER role, get_current_customer_id(),
 *   is_staff_or_admin()) to be applied to the database before they function.
 *   Until then, all actions will return a clear 503-style error message.
 *
 * INVENTORY NOTE:
 *   Submitting an order does NOT deduct egg_inventory.
 *   Inventory is only deducted when STAFF/ADMIN fulfills the order by calling
 *   record_egg_sale() (Migration 003/012 RPC), and linking the resulting sale_id
 *   to the order via updateOrderStatus(). See fulfillOrder() below.
 */

import { getCurrentUserProfile } from "@/lib/user-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { PACKAGING_MULTIPLIERS, ALLOWED_STATUS_TRANSITIONS } from "@/lib/constants";
import {
  submitCustomerOrderSchema,
  cancelCustomerOrderSchema,
  updateOrderStatusSchema,
  type SubmitCustomerOrderInput,
  type CancelCustomerOrderInput,
  type UpdateOrderStatusInput,
} from "@/lib/validations/customer-orders";
import type { CustomerOrderStatus, EggSize, PackagingType } from "@/types";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ─── View Types ───────────────────────────────────────────────────────────────

export interface CustomerOrderItemView {
  id: string;
  size: EggSize;
  packaging: PackagingType;
  package_quantity: number;
  requested_pieces: number;
  quoted_unit_price: number;
  estimated_line_total: number;
}

export interface CustomerOrderView {
  id: string;
  status: CustomerOrderStatus;
  requested_date: string | null;
  sale_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: CustomerOrderItemView[];
  // Estimated total (from quoted prices) — display only, NOT authoritative
  estimated_total: number;
}

export interface EggPriceCatalogEntry {
  size: EggSize;
  price_per_piece: number;
  price_tray_30: number | null;
  price_carton_12: number | null;
  price_box_360: number | null;
  is_available: boolean;
  display_order: number;
  // Derived convenience field for the order form
  stock_pieces?: number;
}

// ─── Helper: Resolve authenticated customer record ────────────────────────────

/**
 * Resolves the customers.id for the currently authenticated CUSTOMER user.
 * Uses Clerk ID linkage first, then verified-email fallback.
 * Returns null if the user is not a CUSTOMER, not active, or has no customer record.
 *
 * SECURITY: This is the ONLY way customer_id is obtained in order mutations.
 */
async function resolveCustomerRecord(
  callerId: string
): Promise<{ id: string; is_active: boolean } | null> {
  const supabase = await createClient();

  // Primary: match via 1-to-1 Clerk user ID linkage (index-backed, no ambiguity)
  const { data: byClerkId } = await supabase
    .from("customers")
    .select("id, is_active")
    .eq("clerk_user_id", callerId)
    .maybeSingle();

  if (byClerkId) return byClerkId;

  // Fallback: match via explicitly verified email from Clerk (safe: Clerk guarantees email ownership)
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  // Locate the verified email: prefer primary email if verified, else any verified address
  const verifiedEmailObj =
    clerkUser.emailAddresses?.find(
      (e) =>
        e.id === clerkUser.primaryEmailAddressId &&
        e.verification?.status === "verified"
    ) ??
    clerkUser.emailAddresses?.find(
      (e) => e.verification?.status === "verified"
    );

  const verifiedEmail = verifiedEmailObj?.emailAddress?.toLowerCase().trim();

  // Fail closed if user has no verified email
  if (!verifiedEmail) return null;

  const { data: byEmail } = await supabase
    .from("customers")
    .select("id, is_active, clerk_user_id")
    .eq("email", verifiedEmail);

  const unlinked = (byEmail ?? []).filter((c) => !c.clerk_user_id);

  if (unlinked.length !== 1) return null; // Ambiguous — fail closed

  // Auto-link the single unambiguous match
  const adminClient = createAdminClient();
  await adminClient
    .from("customers")
    .update({ clerk_user_id: callerId, updated_at: new Date().toISOString() })
    .eq("id", unlinked[0].id);

  return { id: unlinked[0].id, is_active: unlinked[0].is_active };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Fetches the egg price catalog for the product browsing page.
 * Returns only available entries visible to all active authenticated users.
 * Stock levels are joined from egg_inventory for informational display only.
 */
export async function getEggPriceCatalog(): Promise<
  ActionResult<EggPriceCatalogEntry[]>
> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  try {
    const supabase = await createClient();

    const [catalogRes, inventoryRes] = await Promise.all([
      supabase
        .from("egg_price_catalog")
        .select("size, price_per_piece, price_tray_30, price_carton_12, price_box_360, is_available, display_order")
        .order("display_order", { ascending: true })
        .order("size", { ascending: true }),
      supabase
        .from("egg_inventory")
        .select("size, stock_pieces"),
    ]);

    if (catalogRes.error) {
      // Migration 014 not yet applied — return informative message
      if (
        catalogRes.error.message?.includes("does not exist") ||
        catalogRes.error.code === "42P01"
      ) {
        return {
          success: false,
          error:
            "Product catalog is not yet available. Please contact the farm administrator.",
        };
      }
      return { success: false, error: catalogRes.error.message };
    }

    const stockMap = new Map<string, number>(
      (inventoryRes.data ?? []).map((r) => [r.size, r.stock_pieces])
    );

    const catalog = (catalogRes.data ?? []).map((entry) => ({
      size: entry.size as EggSize,
      price_per_piece: Number(entry.price_per_piece) || 0,
      price_tray_30: entry.price_tray_30 != null ? Number(entry.price_tray_30) : null,
      price_carton_12:
        entry.price_carton_12 != null ? Number(entry.price_carton_12) : null,
      price_box_360: entry.price_box_360 != null ? Number(entry.price_box_360) : null,
      is_available: entry.is_available,
      display_order: entry.display_order,
      stock_pieces: stockMap.get(entry.size) ?? 0,
    }));

    return { success: true, data: catalog };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load product catalog.",
    };
  }
}

/**
 * Fetches customer orders for the authenticated CUSTOMER user.
 * RLS ensures only the caller's own orders are returned.
 */
export async function getMyOrders(): Promise<ActionResult<CustomerOrderView[]>> {
  const caller = await getCurrentUserProfile();

  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  if (caller.role !== "CUSTOMER") {
    return {
      success: false,
      error: "Access denied: customer portal is reserved for customer accounts.",
    };
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("customer_orders")
      .select(
        `
        id,
        status,
        requested_date,
        sale_id,
        notes,
        created_at,
        updated_at,
        customer_order_items (
          id,
          size,
          packaging,
          package_quantity,
          requested_pieces,
          quoted_unit_price
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      if (error.message?.includes("does not exist") || error.code === "42P01") {
        return {
          success: true,
          data: [], // Migration 014 not applied yet — return empty gracefully
        };
      }
      return { success: false, error: error.message };
    }

    interface RawOrderItem {
      id: string;
      size: EggSize;
      packaging: PackagingType;
      package_quantity: number;
      requested_pieces: number;
      quoted_unit_price: number;
    }
    interface RawOrder {
      id: string;
      status: string;
      requested_date: string | null;
      sale_id: string | null;
      notes: string | null;
      created_at: string;
      updated_at: string;
      customer_order_items?: RawOrderItem[];
    }

    const orders: CustomerOrderView[] = ((data ?? []) as unknown as RawOrder[]).map(
      (order) => {
        const items: CustomerOrderItemView[] = (order.customer_order_items ?? []).map(
          (item) => {
            const unitPrice = Number(item.quoted_unit_price) || 0;
            return {
              id: item.id,
              size: item.size,
              packaging: item.packaging,
              package_quantity: item.package_quantity,
              requested_pieces: item.requested_pieces,
              quoted_unit_price: unitPrice,
              estimated_line_total: item.package_quantity * unitPrice,
            };
          }
        );

        const estimated_total = items.reduce(
          (sum, i) => sum + i.estimated_line_total,
          0
        );

        return {
          id: order.id,
          status: order.status as CustomerOrderStatus,
          requested_date: order.requested_date,
          sale_id: order.sale_id,
          notes: order.notes,
          created_at: order.created_at,
          updated_at: order.updated_at,
          items,
          estimated_total,
        };
      }
    );

    return { success: true, data: orders };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load orders.",
    };
  }
}

/**
 * STAFF/ADMIN: Fetches all customer orders with customer name for the management view.
 */
export async function getAllOrders(
  limit = 200
): Promise<ActionResult<(CustomerOrderView & { customer_name: string })[]>> {
  const caller = await getCurrentUserProfile();

  if (!caller || !caller.is_active || !["ADMIN", "STAFF"].includes(caller.role)) {
    return {
      success: false,
      error: "Unauthorized: STAFF or ADMIN account required.",
    };
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("customer_orders")
      .select(
        `
        id,
        status,
        requested_date,
        sale_id,
        notes,
        admin_notes,
        cancellation_reason,
        created_at,
        updated_at,
        customer:customers ( id, name ),
        customer_order_items (
          id,
          size,
          packaging,
          package_quantity,
          requested_pieces,
          quoted_unit_price
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      if (error.message?.includes("does not exist") || error.code === "42P01") {
        return { success: true, data: [] };
      }
      return { success: false, error: error.message };
    }

    interface RawOrderItem {
      id: string;
      size: EggSize;
      packaging: PackagingType;
      package_quantity: number;
      requested_pieces: number;
      quoted_unit_price: number;
    }
    interface RawOrderWithCustomer {
      id: string;
      status: string;
      requested_date: string | null;
      sale_id: string | null;
      notes: string | null;
      admin_notes?: string | null;
      cancellation_reason?: string | null;
      created_at: string;
      updated_at: string;
      customer?: { id: string; name: string } | null;
      customer_order_items?: RawOrderItem[];
    }

    const orders = ((data ?? []) as unknown as RawOrderWithCustomer[]).map(
      (order) => {
        const items: CustomerOrderItemView[] = (order.customer_order_items ?? []).map(
          (item) => {
            const unitPrice = Number(item.quoted_unit_price) || 0;
            return {
              id: item.id,
              size: item.size,
              packaging: item.packaging,
              package_quantity: item.package_quantity,
              requested_pieces: item.requested_pieces,
              quoted_unit_price: unitPrice,
              estimated_line_total: item.package_quantity * unitPrice,
            };
          }
        );

        return {
          id: order.id,
          status: order.status as CustomerOrderStatus,
          requested_date: order.requested_date,
          sale_id: order.sale_id,
          notes: order.notes,
          created_at: order.created_at,
          updated_at: order.updated_at,
          items,
          estimated_total: items.reduce((s, i) => s + i.estimated_line_total, 0),
          customer_name: order.customer?.name ?? "Unknown Customer",
        };
      }
    );

    return { success: true, data: orders };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load orders.",
    };
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Submits a new egg order on behalf of the authenticated CUSTOMER.
 *
 * SECURITY GUARANTEES:
 *   - customer_id is resolved exclusively from the Clerk session (server-side).
 *   - Prices are validated against the live catalog at submission time.
 *   - Egg inventory is NOT decremented.
 *   - The order is created with status='PENDING' only.
 *   - Items are inserted only if the order header insert succeeds.
 *   - quoted_unit_price per item must match the catalog value (±0.01 tolerance
 *     for float rounding). Mismatches cause the action to fail.
 */
export async function submitCustomerOrder(
  input: SubmitCustomerOrderInput
): Promise<ActionResult<{ orderId: string }>> {
  const caller = await getCurrentUserProfile();

  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  if (caller.role !== "CUSTOMER") {
    return {
      success: false,
      error: "Only approved CUSTOMER accounts may place orders.",
    };
  }

  // Validate input schema
  const parsed = submitCustomerOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid order input.",
    };
  }

  const { requested_date, notes, items } = parsed.data;

  // Resolve server-side customer record — never trust client
  const customerRecord = await resolveCustomerRecord(caller.id);

  if (!customerRecord) {
    return {
      success: false,
      error:
        "Your account is not linked to a customer record. Please contact the farm administrator.",
    };
  }

  if (!customerRecord.is_active) {
    return {
      success: false,
      error:
        "Your customer account is not active. Orders cannot be submitted until an administrator approves your account.",
    };
  }

  try {
    const supabase = await createClient();

    // ── Validate prices against live catalog ─────────────────────────────────
    // Fetch catalog entries for all sizes requested
    const requestedSizes = [...new Set(items.map((i) => i.size))];
    const { data: catalogEntries, error: catalogError } = await supabase
      .from("egg_price_catalog")
      .select(
        "size, price_per_piece, price_tray_30, price_carton_12, price_box_360, is_available"
      )
      .in("size", requestedSizes);

    if (catalogError) {
      if (
        catalogError.message?.includes("does not exist") ||
        catalogError.code === "42P01"
      ) {
        return {
          success: false,
          error:
            "Ordering is not yet available. Please contact the farm administrator.",
        };
      }
      return { success: false, error: catalogError.message };
    }

    const catalogMap = new Map<
      string,
      {
        price_per_piece: number;
        price_tray_30: number | null;
        price_carton_12: number | null;
        price_box_360: number | null;
        is_available: boolean;
      }
    >();

    for (const entry of catalogEntries ?? []) {
      catalogMap.set(entry.size, {
        price_per_piece: Number(entry.price_per_piece) || 0,
        price_tray_30: entry.price_tray_30 != null ? Number(entry.price_tray_30) : null,
        price_carton_12:
          entry.price_carton_12 != null ? Number(entry.price_carton_12) : null,
        price_box_360:
          entry.price_box_360 != null ? Number(entry.price_box_360) : null,
        is_available: entry.is_available,
      });
    }

    // Validate each item against the catalog
    for (const item of items) {
      const catalog = catalogMap.get(item.size);

      if (!catalog) {
        return {
          success: false,
          error: `Size "${item.size}" is not found in the product catalog. Please refresh and try again.`,
        };
      }

      if (!catalog.is_available) {
        return {
          success: false,
          error: `Size "${item.size}" is currently not available for ordering. Please check the product catalog.`,
        };
      }

      // Determine the expected quoted price for this packaging type
      let expectedPrice: number;
      switch (item.packaging) {
        case "TRAY_30":
          expectedPrice =
            catalog.price_tray_30 ??
            catalog.price_per_piece * PACKAGING_MULTIPLIERS["TRAY_30"];
          break;
        case "CARTON_12":
          expectedPrice =
            catalog.price_carton_12 ??
            catalog.price_per_piece * PACKAGING_MULTIPLIERS["CARTON_12"];
          break;
        case "BOX_360":
          expectedPrice =
            catalog.price_box_360 ??
            catalog.price_per_piece * PACKAGING_MULTIPLIERS["BOX_360"];
          break;
        case "PIECE":
        default:
          expectedPrice = catalog.price_per_piece;
          break;
      }

      // Reject if quoted price deviates by more than ₱0.01 (prevents price tampering)
      if (Math.abs(item.quoted_unit_price - expectedPrice) > 0.01) {
        return {
          success: false,
          error: `Price mismatch for ${item.size} ${item.packaging}. Please refresh the page and resubmit your order.`,
        };
      }
    }

    // ── Validate no duplicate size+packaging combos ───────────────────────────
    const itemKeys = new Set<string>();
    for (const item of items) {
      const key = `${item.size}:${item.packaging}`;
      if (itemKeys.has(key)) {
        return {
          success: false,
          error: `Duplicate item: ${item.size} / ${item.packaging}. Combine them into a single line.`,
        };
      }
      itemKeys.add(key);
    }

    // ── Insert order header ──────────────────────────────────────────────────
    const { data: orderData, error: orderError } = await supabase
      .from("customer_orders")
      .insert({
        customer_id: customerRecord.id,     // Server-resolved, never client
        status: "PENDING",                   // Hardcoded — RLS enforces this too
        requested_date: requested_date || null,
        notes: notes?.trim() || null,
        sale_id: null,                        // Set only by STAFF/ADMIN at fulfillment
        admin_notes: null,                    // Set only by STAFF/ADMIN
        cancellation_reason: null,            // Set only on cancellation
      })
      .select("id")
      .single();

    if (orderError) {
      return { success: false, error: orderError.message };
    }

    const orderId = orderData.id;

    // ── Insert order items ───────────────────────────────────────────────────
    const itemRows = items.map((item) => ({
      order_id: orderId,
      size: item.size,
      packaging: item.packaging,
      package_quantity: item.package_quantity,
      requested_pieces:
        item.package_quantity * PACKAGING_MULTIPLIERS[item.packaging],
      quoted_unit_price: item.quoted_unit_price,
    }));

    const { error: itemsError } = await supabase
      .from("customer_order_items")
      .insert(itemRows);

    if (itemsError) {
      // Attempt to clean up orphaned order header (best effort)
      await supabase.from("customer_orders").delete().eq("id", orderId);
      return { success: false, error: itemsError.message };
    }

    // ── Audit log (best effort via admin client) ──────────────────────────────
    try {
      const adminClient = createAdminClient();
      await adminClient.from("activity_logs").insert({
        actor_id: caller.id,
        action: "CUSTOMER_ORDER_SUBMITTED",
        entity_table: "customer_orders",
        entity_id: orderId,
        metadata: {
          customer_id: customerRecord.id,
          item_count: items.length,
          requested_date: requested_date || null,
          status: "PENDING",
        },
      });
    } catch (auditErr) {
      console.warn("Could not write CUSTOMER_ORDER_SUBMITTED audit log:", auditErr);
    }

    revalidatePath("/customer/orders");
    revalidatePath("/customer/dashboard");

    return { success: true, data: { orderId } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to submit order.",
    };
  }
}

/**
 * Allows a CUSTOMER to cancel their own PENDING order.
 * CUSTOMERS cannot cancel orders that have already been confirmed or beyond.
 */
export async function cancelMyOrder(
  input: CancelCustomerOrderInput
): Promise<ActionResult> {
  const caller = await getCurrentUserProfile();

  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  if (caller.role !== "CUSTOMER") {
    return {
      success: false,
      error:
        "Customers can only cancel their own pending orders. Please contact STAFF or ADMIN to cancel confirmed orders.",
    };
  }

  const parsed = cancelCustomerOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { order_id } = parsed.data;

  const customerRecord = await resolveCustomerRecord(caller.id);
  if (!customerRecord) {
    return { success: false, error: "Customer record not found." };
  }

  try {
    const supabase = await createClient();

    // Fetch and verify ownership + status
    const { data: order, error: fetchErr } = await supabase
      .from("customer_orders")
      .select("id, status, customer_id")
      .eq("id", order_id)
      .single();

    if (fetchErr || !order) {
      return { success: false, error: "Order not found." };
    }

    // Strict ownership check (belt + suspenders — RLS also enforces this)
    if (order.customer_id !== customerRecord.id) {
      return { success: false, error: "Order not found." }; // Obfuscate existence
    }

    if (order.status !== "PENDING") {
      return {
        success: false,
        error: `Only PENDING orders can be cancelled by customers. This order is currently ${order.status}. Please contact the farm administrator.`,
      };
    }

    // RLS UPDATE policy for customers does NOT exist — must use admin client.
    // Concurrency-safe atomic UPDATE:
    // Update only when order ID, customer_id, AND status='PENDING' all match.
    // If farm staff concurrently moved the status to CONFIRMED or PREPARING,
    // this query will update 0 rows instead of clobbering the updated status.
    const adminClient = createAdminClient();
    const { data: updatedRows, error: updateErr } = await adminClient
      .from("customer_orders")
      .update({
        status: "CANCELLED",
        cancellation_reason: "Cancelled by customer.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order_id)
      .eq("customer_id", customerRecord.id)
      .eq("status", "PENDING")
      .select("id");

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      return {
        success: false,
        error:
          "Order could not be cancelled because its status has changed. Please refresh the page.",
      };
    }

    // Audit log
    try {
      await adminClient.from("activity_logs").insert({
        actor_id: caller.id,
        action: "CUSTOMER_ORDER_CANCELLED",
        entity_table: "customer_orders",
        entity_id: order_id,
        metadata: {
          customer_id: customerRecord.id,
          cancelled_by: "CUSTOMER",
          previous_status: "PENDING",
        },
      });
    } catch (auditErr) {
      console.warn("Could not write CUSTOMER_ORDER_CANCELLED audit log:", auditErr);
    }

    revalidatePath("/customer/orders");
    revalidatePath("/customer/dashboard");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to cancel order.",
    };
  }
}



/**
 * STAFF/ADMIN: Updates an order's status, admin notes, or linked sale_id.
 *
 * SECURITY: Caller must be STAFF or ADMIN with an active account.
 * Customers cannot call this action.
 */
export async function updateOrderStatus(
  input: UpdateOrderStatusInput
): Promise<ActionResult> {
  const caller = await getCurrentUserProfile();

  if (!caller || !caller.is_active || !["ADMIN", "STAFF"].includes(caller.role)) {
    return {
      success: false,
      error: "Unauthorized: STAFF or ADMIN account required.",
    };
  }

  const parsed = updateOrderStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { order_id, status, admin_notes, cancellation_reason, sale_id } = parsed.data;

  // Cancellation requires a reason
  if (status === "CANCELLED" && !cancellation_reason?.trim()) {
    return {
      success: false,
      error: "A cancellation reason is required when cancelling an order.",
    };
  }

  try {
    const supabase = await createClient();

    // Verify order exists
    const { data: existing, error: fetchErr } = await supabase
      .from("customer_orders")
      .select("id, status")
      .eq("id", order_id)
      .single();

    if (fetchErr || !existing) {
      return { success: false, error: "Order not found." };
    }

    const currentStatus = existing.status as CustomerOrderStatus;

    // Validate state-machine transition
    if (status !== currentStatus) {
      const allowedTargets = ALLOWED_STATUS_TRANSITIONS[currentStatus] ?? [];
      if (!allowedTargets.includes(status)) {
        return {
          success: false,
          error: `Invalid status transition: cannot change order from ${currentStatus} to ${status}. Allowed next statuses: ${
            allowedTargets.length > 0
              ? allowedTargets.join(", ")
              : "None (order is in a terminal state)"
          }.`,
        };
      }
    }

    const updatePayload: {
      status: CustomerOrderStatus;
      updated_at: string;
      admin_notes?: string | null;
      cancellation_reason?: string | null;
      sale_id?: string | null;
    } = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (admin_notes !== undefined) {
      updatePayload.admin_notes = admin_notes?.trim() || null;
    }

    if (cancellation_reason !== undefined) {
      updatePayload.cancellation_reason = cancellation_reason?.trim() || null;
    }

    if (sale_id !== undefined) {
      updatePayload.sale_id = sale_id;
    }

    // Concurrency-safe atomic UPDATE:
    // Enforce .eq("status", currentStatus) in the WHERE clause so that if the order
    // was modified concurrently by another staff member or customer cancellation,
    // the query will match 0 rows instead of silently clobbering the conflicting status.
    const { data: updatedRows, error: updateErr } = await supabase
      .from("customer_orders")
      .update(updatePayload)
      .eq("id", order_id)
      .eq("status", currentStatus)
      .select("id");

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      return {
        success: false,
        error:
          "Order status could not be updated because it was modified concurrently by another user. Please refresh and try again.",
      };
    }

    // Audit log
    try {
      const adminClient = createAdminClient();
      await adminClient.from("activity_logs").insert({
        actor_id: caller.id,
        action: "CUSTOMER_ORDER_STATUS_CHANGED",
        entity_table: "customer_orders",
        entity_id: order_id,
        metadata: {
          previous_status: existing.status,
          new_status: status,
          sale_id: sale_id ?? null,
          changed_by_role: caller.role,
        },
      });
    } catch (auditErr) {
      console.warn("Could not write CUSTOMER_ORDER_STATUS_CHANGED audit log:", auditErr);
    }

    revalidatePath("/customer/orders");
    revalidatePath("/customer/dashboard");
    // Revalidate STAFF/ADMIN management view
    revalidatePath("/egg-sales");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update order status.",
    };
  }
}
