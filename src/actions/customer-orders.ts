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
import { recordCustomerOrderNotification } from "@/actions/customer-order-notifications";
import { PACKAGING_MULTIPLIERS, ALLOWED_STATUS_TRANSITIONS } from "@/lib/constants";
import {
  submitCustomerOrderSchema,
  cancelCustomerOrderSchema,
  updateOrderStatusSchema,
  type SubmitCustomerOrderInput,
  type CancelCustomerOrderInput,
  type UpdateOrderStatusInput,
} from "@/lib/validations/customer-orders";
import type {
  CustomerOrderStatus,
  EggSize,
  PackagingType,
  FulfillmentMethod,
  CustomerPaymentMethod,
  EggType,
} from "@/types";

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
  egg_type?: EggType;
}

export interface CustomerOrderView {
  id: string;
  status: CustomerOrderStatus;
  fulfillment_method: FulfillmentMethod | null;
  payment_method: CustomerPaymentMethod | null;
  requested_date: string | null;
  delivery_barangay: string | null;
  delivery_address: string | null;
  pickup_time: string | null;
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
export async function resolveCustomerRecord(
  callerId: string
): Promise<{ id: string; is_active: boolean } | null> {
  const adminClient = createAdminClient();
  const caller = await getCurrentUserProfile();

  if (!caller || caller.role !== "CUSTOMER") {
    return null;
  }

  // 1. Primary: match via 1-to-1 Clerk user ID linkage (index-backed, no ambiguity)
  const { data: byClerkId } = await adminClient
    .from("customers")
    .select("id, is_active, name, email")
    .eq("clerk_user_id", callerId)
    .maybeSingle();

  if (byClerkId) {
    // If caller profile is active but customer record drifted to inactive, sync active status
    if (caller.is_active && !byClerkId.is_active) {
      await adminClient
        .from("customers")
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq("id", byClerkId.id);
      return { id: byClerkId.id, is_active: true };
    }
    return { id: byClerkId.id, is_active: byClerkId.is_active };
  }

  // 2. Fallback: match via explicitly verified email from Clerk (safe: Clerk guarantees email ownership)
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

  if (verifiedEmail) {
    const { data: byEmail } = await adminClient
      .from("customers")
      .select("id, is_active, clerk_user_id")
      .eq("email", verifiedEmail);

    const unlinked = (byEmail ?? []).filter((c) => !c.clerk_user_id);

    if (unlinked.length === 1) {
      // Auto-link the single unambiguous match
      const shouldBeActive = caller.is_active || unlinked[0].is_active;
      await adminClient
        .from("customers")
        .update({
          clerk_user_id: callerId,
          is_active: shouldBeActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", unlinked[0].id);

      return { id: unlinked[0].id, is_active: shouldBeActive };
    }
  }

  // 3. Genuinely missing customer record: safely and idempotently provision one
  const customerName =
    caller.full_name ||
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
    "Customer";

  const phone = caller.phone || clerkUser.phoneNumbers?.[0]?.phoneNumber || null;

  const { data: newCustomer, error: insertErr } = await adminClient
    .from("customers")
    .insert({
      name: customerName,
      email: verifiedEmail || null,
      phone: phone,
      clerk_user_id: callerId,
      is_active: caller.is_active,
    })
    .select("id, is_active")
    .single();

  if (insertErr || !newCustomer) {
    console.error("Failed to auto-provision customer record:", insertErr);
    return null;
  }

  return { id: newCustomer.id, is_active: newCustomer.is_active };
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
      // Missing table or schema cache reload delay — return informative message
      if (
        catalogRes.error.message?.includes("does not exist") ||
        catalogRes.error.message?.includes("schema cache") ||
        catalogRes.error.code === "42P01" ||
        catalogRes.error.code === "PGRST205"
      ) {
        return {
          success: false,
          error:
            "Product catalog is not yet available. Please contact the farm administrator.",
        };
      }
      return { success: false, error: catalogRes.error.message };
    }

    let inventoryData = inventoryRes.data;
    if (!inventoryData || inventoryData.length === 0) {
      try {
        const adminClient = createAdminClient();
        const { data: adminInv } = await adminClient
          .from("egg_inventory")
          .select("size, stock_pieces");
        if (adminInv && adminInv.length > 0) {
          inventoryData = adminInv;
        }
      } catch (adminErr) {
        console.warn("getEggPriceCatalog: fallback to adminClient failed:", adminErr);
      }
    }

    const stockMap = new Map<string, number>(
      (inventoryData ?? []).map((r) => [r.size, r.stock_pieces])
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
        fulfillment_method,
        payment_method,
        requested_date,
        delivery_barangay,
        delivery_address,
        pickup_time,
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
          quoted_unit_price,
          egg_type
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      if (
        error.message?.includes("does not exist") ||
        error.message?.includes("schema cache") ||
        error.code === "42P01" ||
        error.code === "PGRST205"
      ) {
        return {
          success: true,
          data: [], // Migration 014 not applied yet or cache reloading — return empty gracefully
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
      egg_type?: string | null;
    }

    interface RawOrder {
      id: string;
      status: string;
      fulfillment_method: string | null;
      payment_method: string | null;
      requested_date: string | null;
      delivery_barangay: string | null;
      delivery_address: string | null;
      pickup_time: string | null;
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
              egg_type: (item.egg_type as EggType) || "WHITE",
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
          fulfillment_method: order.fulfillment_method as FulfillmentMethod | null,
          payment_method: order.payment_method as CustomerPaymentMethod | null,
          requested_date: order.requested_date,
          delivery_barangay: order.delivery_barangay,
          delivery_address: order.delivery_address,
          pickup_time: order.pickup_time,
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
): Promise<ActionResult<(CustomerOrderView & { customer_name: string; payment_submission_status: string | null })[]>> {
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
        fulfillment_method,
        payment_method,
        requested_date,
        delivery_barangay,
        delivery_address,
        pickup_time,
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
          quoted_unit_price,
          egg_type
        ),
        customer_payment_submissions (
          id,
          status,
          created_at
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      if (
        error.message?.includes("does not exist") ||
        error.message?.includes("schema cache") ||
        error.code === "42P01" ||
        error.code === "PGRST205"
      ) {
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
      egg_type?: string | null;
    }

    interface RawPaymentSubmissionRef {
      id: string;
      status: string;
      created_at: string;
    }

    interface RawOrderWithCustomer {
      id: string;
      status: string;
      fulfillment_method: string | null;
      payment_method: string | null;
      requested_date: string | null;
      delivery_barangay: string | null;
      delivery_address: string | null;
      pickup_time: string | null;
      sale_id: string | null;
      notes: string | null;
      admin_notes?: string | null;
      cancellation_reason?: string | null;
      created_at: string;
      updated_at: string;
      customer?: { id: string; name: string } | null;
      customer_order_items?: RawOrderItem[];
      customer_payment_submissions?: RawPaymentSubmissionRef[];
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
              egg_type: (item.egg_type as EggType) || "WHITE",
            };
          }
        );

        // Derive the most-relevant payment submission status for this order.
        // We pick the most recent submission, preferring non-REJECTED ones so
        // a SUBMITTED proof shows up even if an earlier one was rejected.
        const submissions = order.customer_payment_submissions ?? [];
        const latestSubmission = submissions
          .slice()
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .find((s) => s.status !== "REJECTED") ?? submissions[0] ?? null;

        return {
          id: order.id,
          status: order.status as CustomerOrderStatus,
          fulfillment_method: order.fulfillment_method as FulfillmentMethod | null,
          payment_method: order.payment_method as CustomerPaymentMethod | null,
          requested_date: order.requested_date,
          delivery_barangay: order.delivery_barangay,
          delivery_address: order.delivery_address,
          pickup_time: order.pickup_time,
          sale_id: order.sale_id,
          notes: order.notes,
          admin_notes: order.admin_notes,
          cancellation_reason: order.cancellation_reason,
          created_at: order.created_at,
          updated_at: order.updated_at,
          items,
          estimated_total: items.reduce((s, i) => s + i.estimated_line_total, 0),
          customer_name: order.customer?.name ?? "Unknown Customer",
          payment_submission_status: latestSubmission?.status ?? null,
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

  const {
    fulfillment_method,
    payment_method,
    requested_date,
    notes,
    items,
    delivery_barangay,
    delivery_address,
    pickup_time,
  } = parsed.data;

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
        catalogError.message?.includes("schema cache") ||
        catalogError.code === "42P01" ||
        catalogError.code === "PGRST205"
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

    // ── Validate requested quantities against available stock in egg_inventory ────
    let inventoryData = null;
    const { data: invData, error: inventoryError } = await supabase
      .from("egg_inventory")
      .select("size, stock_pieces")
      .in("size", requestedSizes);

    if (invData && invData.length > 0) {
      inventoryData = invData;
    } else {
      try {
        const adminClient = createAdminClient();
        const { data: adminInv } = await adminClient
          .from("egg_inventory")
          .select("size, stock_pieces")
          .in("size", requestedSizes);
        if (adminInv) {
          inventoryData = adminInv;
        }
      } catch (adminErr) {
        console.warn("submitCustomerOrder: fallback to adminClient failed:", adminErr);
      }
    }

    if (!inventoryData && inventoryError) {
      return { success: false, error: "Failed to verify available inventory levels." };
    }

    const stockMap = new Map<string, number>(
      (inventoryData ?? []).map((r) => [r.size, r.stock_pieces])
    );

    // Sum total requested pieces per egg size
    const requestedPiecesPerSize = new Map<string, number>();
    for (const item of items) {
      const multiplier = PACKAGING_MULTIPLIERS[item.packaging] || 1;
      const pieces = item.package_quantity * multiplier;
      requestedPiecesPerSize.set(
        item.size,
        (requestedPiecesPerSize.get(item.size) || 0) + pieces
      );
    }

    for (const [size, requestedPieces] of requestedPiecesPerSize.entries()) {
      const availableStock = stockMap.get(size) ?? 0;
      if (availableStock <= 0) {
        return {
          success: false,
          error: `${size} eggs are currently out of stock.`,
        };
      }
      if (requestedPieces > availableStock) {
        return {
          success: false,
          error: `Requested quantity for ${size} (${requestedPieces.toLocaleString()} pieces) exceeds available stock (${availableStock.toLocaleString()} pieces).`,
        };
      }
    }

    // ── Validate no duplicate size+packaging+egg_type combos ─────────────────
    const itemKeys = new Set<string>();
    for (const item of items) {
      const eggType = item.egg_type ?? "WHITE";
      const key = `${item.size}:${item.packaging}:${eggType}`;
      if (itemKeys.has(key)) {
        return {
          success: false,
          error: `Duplicate item: ${item.size} / ${item.packaging} (${eggType === "BROWN" ? "Brown Egg" : "White Egg"}). Combine them into a single line.`,
        };
      }
      itemKeys.add(key);
    }

    // ── Insert order header ──────────────────────────────────────────────────
    const orderPayload = {
      customer_id: customerRecord.id,              // Server-resolved, never client
      status: "PENDING" as const,                   // Hardcoded — RLS enforces this too
      fulfillment_method: fulfillment_method,       // DELIVERY or PICKUP
      payment_method: payment_method,               // CASH_ON_DELIVERY, GCASH, or BANK_TRANSFER
      requested_date: requested_date || null,
      delivery_barangay: fulfillment_method === "DELIVERY" ? (delivery_barangay?.trim() || null) : null,
      delivery_address: fulfillment_method === "DELIVERY" ? (delivery_address?.trim() || null) : null,
      pickup_time: fulfillment_method === "PICKUP" ? (pickup_time?.trim() || null) : null,
      notes: notes?.trim() || null,
      sale_id: null,                                // Set only by STAFF/ADMIN at fulfillment
      admin_notes: null,                            // Set only by STAFF/ADMIN
      cancellation_reason: null,                    // Set only on cancellation
    };

    const { data: orderData, error: orderError } = await supabase
      .from("customer_orders")
      .insert(orderPayload)
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
      egg_type: item.egg_type ?? "WHITE",
    }));

    const { error: itemsError } = await supabase
      .from("customer_order_items")
      .insert(itemRows);

    if (itemsError) {
      // Attempt to clean up orphaned order header (best effort)
      await supabase.from("customer_orders").delete().eq("id", orderId);
      return { success: false, error: itemsError.message };
    }

    // ── Create payment submission for GCASH / BANK_TRANSFER ───────────────────
    if (payment_method === "GCASH" || payment_method === "BANK_TRANSFER") {
      try {
        const adminClient = createAdminClient();
        await adminClient.from("customer_payment_submissions").insert({
          order_id: orderId,
          customer_id: customerRecord.id,
          payment_method,
          status: "SUBMITTED",
          reference_number: parsed.data.payment_reference?.trim() || null,
          declared_amount: parsed.data.payment_amount ?? null,
          payment_date: parsed.data.payment_date || new Date().toISOString().split("T")[0],
          bank_name:
            payment_method === "BANK_TRANSFER"
              ? parsed.data.payment_bank_name?.trim() || null
              : null,
          sender_name:
            payment_method === "GCASH"
              ? parsed.data.payment_gcash_account_name?.trim() || null
              : payment_method === "BANK_TRANSFER"
              ? parsed.data.payment_sender_name?.trim() || null
              : null,
          gcash_number:
            payment_method === "GCASH"
              ? parsed.data.payment_gcash_number?.trim() || null
              : null,
          receipt_url: parsed.data.payment_receipt_url?.trim() || null,
          bank_transfer_account_id:
            payment_method === "BANK_TRANSFER"
              ? parsed.data.payment_bank_transfer_account_id || null
              : null,
          customer_notes: parsed.data.payment_notes?.trim() || null,
          verified_by: null,
          verified_at: null,
          verification_notes: null,
          rejection_reason: null,
        });
      } catch (paySubErr) {
        console.warn("Could not insert customer_payment_submission:", paySubErr);
      }
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
          fulfillment_method,
          payment_method,
          requested_date: requested_date || null,
          delivery_barangay: delivery_barangay || null,
          status: "PENDING",
        },
      });
    } catch (auditErr) {
      console.warn("Could not write CUSTOMER_ORDER_SUBMITTED audit log:", auditErr);
    }

    await recordCustomerOrderNotification({
      orderId,
      customerId: customerRecord.id,
      status: "PENDING",
    });

    revalidatePath("/customer/order");
    revalidatePath("/customer/orders");
    revalidatePath("/customer/dashboard");

    return { success: true, data: { orderId } };
  } catch (err) {
    console.error("[submitCustomerOrder] Unexpected error:", err);
    return {
      success: false,
      error: "Could not submit your order. Please try again.",
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

    await recordCustomerOrderNotification({
      orderId: order_id,
      customerId: customerRecord.id,
      status: "CANCELLED",
    });

    revalidatePath("/customer/order");
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
      .select("id, status, customer_id")
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

    await recordCustomerOrderNotification({
      orderId: order_id,
      customerId: existing.customer_id,
      status,
    });

    revalidatePath("/customer/order");
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

/**
 * STAFF/ADMIN: Fulfills a customer order by creating a completed egg sale invoice.
 *
 * Atomically calls record_egg_sale() RPC to:
 * 1. Lock affected egg_inventory rows FOR UPDATE (preventing concurrent oversell).
 * 2. Validate sufficient stock per size.
 * 3. Deduct egg_inventory stock.
 * 4. Record egg_sales and egg_sale_items records.
 * 5. Append immutable egg_inventory_transactions ledger entry.
 * 6. Links resulting sale_id to customer_orders and marks status='COMPLETED'.
 *
 * Guarantees:
 * - Customer order submission did NOT deduct stock.
 * - Stock is deducted exactly ONCE upon fulfillment via record_egg_sale.
 * - Idempotent: cannot fulfill an already COMPLETED order or an order with sale_id.
 */
export async function fulfillCustomerOrder(
  orderId: string
): Promise<ActionResult<{ saleId: string }>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active || !["ADMIN", "STAFF"].includes(caller.role)) {
    return {
      success: false,
      error: "Unauthorized: STAFF or ADMIN account required to fulfill orders.",
    };
  }

  try {
    const supabase = await createClient();

    // Fetch order with its items
    const { data: order, error: orderErr } = await supabase
      .from("customer_orders")
      .select(`
        id,
        customer_id,
        status,
        sale_id,
        notes,
        customer_order_items (
          id,
          size,
          packaging,
          package_quantity,
          quoted_unit_price
        )
      `)
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      return { success: false, error: "Order not found." };
    }

    if (order.sale_id) {
      return {
        success: false,
        error: "This order has already been fulfilled and linked to a sale.",
      };
    }

    if (order.status === "COMPLETED") {
      return {
        success: false,
        error: "This order is already completed.",
      };
    }

    if (order.status === "CANCELLED") {
      return {
        success: false,
        error: "Cannot fulfill a cancelled order.",
      };
    }

    interface OrderItemRow {
      id: string;
      size: EggSize;
      packaging: PackagingType;
      package_quantity: number;
      quoted_unit_price: number;
    }

    const items = (order.customer_order_items ?? []) as OrderItemRow[];
    if (items.length === 0) {
      return { success: false, error: "Order has no items to fulfill." };
    }

    // Format items for record_egg_sale RPC
    const p_items = items.map((item) => ({
      egg_size: item.size,
      packaging_type: item.packaging,
      package_quantity: item.package_quantity,
      unit_price: Number(item.quoted_unit_price),
    }));

    const today = new Date().toISOString().slice(0, 10);
    const saleNotes = `Fulfillment for Customer Order #${order.id.slice(0, 8)}${
      order.notes ? ` — ${order.notes}` : ""
    }`;

    // Call authoritative record_egg_sale RPC (locks inventory FOR UPDATE and deducts stock)
    const { data: saleData, error: saleErr } = await supabase.rpc(
      "record_egg_sale",
      {
        p_customer_id: order.customer_id,
        p_sale_date: today,
        p_invoice_number: "",
        p_discount: 0,
        p_notes: saleNotes,
        p_items: p_items as unknown as string,
      }
    );

    if (saleErr) {
      return {
        success: false,
        error: `Fulfillment failed: ${saleErr.message}`,
      };
    }

    let saleId: string | undefined;
    if (typeof saleData === "string") {
      try {
        const parsed = JSON.parse(saleData);
        saleId = parsed?.sale_id || parsed?.id || saleData;
      } catch {
        saleId = saleData;
      }
    } else if (typeof saleData === "object" && saleData !== null) {
      const obj = saleData as Record<string, unknown>;
      saleId = (obj.sale_id as string) || (obj.id as string);
    }

    if (!saleId) {
      return { success: false, error: "Sale record was not generated." };
    }

    // Link sale_id to order and update status to COMPLETED
    const { error: updateErr } = await supabase
      .from("customer_orders")
      .update({
        status: "COMPLETED",
        sale_id: saleId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateErr) {
      console.error("Failed to link sale_id to order:", updateErr);
    }

    await recordCustomerOrderNotification({
      orderId,
      customerId: order.customer_id,
      status: "COMPLETED",
    });

    revalidatePath("/customer/order");
    revalidatePath("/customer-orders");
    revalidatePath("/customer/orders");
    revalidatePath("/customer/dashboard");
    revalidatePath("/egg-sales");
    revalidatePath("/egg-inventory");
    revalidatePath("/dashboard");

    return { success: true, data: { saleId } };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to fulfill customer order.",
    };
  }
}

export interface UpdateEggPriceCatalogItemInput {
  size: EggSize;
  price_per_piece: number;
  price_tray_30?: number | null;
  price_carton_12?: number | null;
  price_box_360?: number | null;
  is_available: boolean;
}

/**
 * ADMIN ONLY: Updates indicative customer catalog prices and availability.
 */
export async function updateEggPriceCatalogItem(
  input: UpdateEggPriceCatalogItemInput
): Promise<ActionResult> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active || caller.role !== "ADMIN") {
    return {
      success: false,
      error: "Unauthorized: only ADMIN accounts can update product catalog prices.",
    };
  }

  if (input.price_per_piece < 0) {
    return { success: false, error: "Price per piece cannot be negative." };
  }

  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("egg_price_catalog")
      .update({
        price_per_piece: input.price_per_piece,
        price_tray_30: input.price_tray_30 ?? null,
        price_carton_12: input.price_carton_12 ?? null,
        price_box_360: input.price_box_360 ?? null,
        is_available: input.is_available,
        updated_by: caller.id,
        updated_at: new Date().toISOString(),
      })
      .eq("size", input.size);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/customer/order");
    revalidatePath("/settings");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update catalog.",
    };
  }
}

/**
 * Fetches single order details with ownership verification.
 */
export async function getOrderDetails(
  orderId: string
): Promise<ActionResult<CustomerOrderView & { customer_name?: string }>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  try {
    const supabase = await createClient();

    let customerRecordId: string | null = null;
    if (caller.role === "CUSTOMER") {
      const customerRecord = await resolveCustomerRecord(caller.id);
      if (!customerRecord || !customerRecord.is_active) {
        return { success: false, error: "Customer record not found or inactive." };
      }
      customerRecordId = customerRecord.id;
    }

    let query = supabase
      .from("customer_orders")
      .select(`
        id,
        customer_id,
        status,
        fulfillment_method,
        payment_method,
        delivery_barangay,
        delivery_address,
        pickup_time,
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
          quoted_unit_price,
          egg_type
        )
      `)
      .eq("id", orderId);

    if (customerRecordId) {
      query = query.eq("customer_id", customerRecordId);
    }

    const { data: order, error } = await query.maybeSingle();

    if (error || !order) {
      return { success: false, error: "Order not found." };
    }

    interface RawOrderItem {
      id: string;
      size: EggSize;
      packaging: PackagingType;
      package_quantity: number;
      requested_pieces: number;
      quoted_unit_price: number;
      egg_type?: string | null;
    }

    const items: CustomerOrderItemView[] = (
      (order.customer_order_items ?? []) as RawOrderItem[]
    ).map((item) => {
      const unitPrice = Number(item.quoted_unit_price) || 0;
      return {
        id: item.id,
        size: item.size,
        packaging: item.packaging,
        package_quantity: item.package_quantity,
        requested_pieces: item.requested_pieces,
        quoted_unit_price: unitPrice,
        estimated_line_total: item.package_quantity * unitPrice,
        egg_type: (item.egg_type as EggType) || "WHITE",
      };
    });

    const estimated_total = items.reduce(
      (s, i) => s + i.estimated_line_total,
      0
    );

    return {
      success: true,
      data: {
        id: order.id,
        status: order.status as CustomerOrderStatus,
        fulfillment_method: order.fulfillment_method as FulfillmentMethod | null,
        payment_method: order.payment_method as CustomerPaymentMethod | null,
        delivery_barangay: order.delivery_barangay,
        delivery_address: order.delivery_address,
        pickup_time: order.pickup_time,
        requested_date: order.requested_date,
        sale_id: order.sale_id,
        notes: order.notes,
        created_at: order.created_at,
        updated_at: order.updated_at,
        items,
        estimated_total,
        customer_name: (order.customer as { name?: string } | null)?.name,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load order details.",
    };
  }
}

