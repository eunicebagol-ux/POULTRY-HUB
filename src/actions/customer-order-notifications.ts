"use server";

/**
 * POULTRY HUB — Customer Order Status Notifications Server Actions
 *
 * SECURITY CONTRACT:
 *   1. customer_id is ALWAYS resolved server-side via resolveCustomerRecord().
 *      Never accepted from client.
 *   2. Customers can only read and dismiss their own notifications.
 *   3. Record creation is triggered server-side on order state changes.
 *   4. Gracefully falls back to customer_orders when migration 027 table
 *      is not yet created in the database.
 */

import { getCurrentUserProfile } from "@/lib/user-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { resolveCustomerRecord } from "@/actions/customer-orders";
import type { CustomerOrderStatus } from "@/types";
import {
  ORDER_STATUS_NOTIFICATION_CONFIG,
  type CustomerOrderNotificationView,
} from "@/lib/customer-order-notification-config";

// Re-export the view type so existing importers of this file continue to work
export type { CustomerOrderNotificationView };

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

/**
 * Server-side helper called when an order's status changes.
 * Records the notification in customer_order_notifications table.
 */
export async function recordCustomerOrderNotification({
  orderId,
  customerId,
  status,
}: {
  orderId: string;
  customerId: string;
  status: CustomerOrderStatus;
}): Promise<void> {
  const config = ORDER_STATUS_NOTIFICATION_CONFIG[status];
  if (!config) return;

  try {
    const adminClient = createAdminClient();

    // Insert new notification record.
    // If a notification for (order_id, status) already exists, this is safely ignored.
    const { error } = await adminClient
      .from("customer_order_notifications")
      .upsert(
        {
          order_id: orderId,
          customer_id: customerId,
          status,
          title: config.title,
          message: config.message,
          is_dismissed: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "order_id,status" }
      );

    if (error && !error.message?.includes("does not exist")) {
      console.warn("recordCustomerOrderNotification error:", error.message);
    }
  } catch (err) {
    console.warn("Could not record customer order notification:", err);
  }
}

/**
 * Fetches the latest undismissed order status notification for the current customer.
 * Used on the customer Place an Order page directly above 'Your Cart'.
 */
export async function getLatestCustomerOrderNotification(): Promise<
  ActionResult<CustomerOrderNotificationView | null>
> {
  const caller = await getCurrentUserProfile();

  if (!caller || !caller.is_active || caller.role !== "CUSTOMER") {
    return { success: true, data: null };
  }

  const customerRecord = await resolveCustomerRecord(caller.id);
  if (!customerRecord) {
    return { success: true, data: null };
  }

  try {
    const supabase = await createClient();

    // 1. Try reading from customer_order_notifications table
    const { data: notifData, error: notifErr } = await supabase
      .from("customer_order_notifications")
      .select("id, order_id, status, title, message, is_dismissed, created_at")
      .eq("customer_id", customerRecord.id)
      .eq("is_dismissed", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!notifErr && notifData) {
      return {
        success: true,
        data: {
          id: notifData.id,
          order_id: notifData.order_id,
          status: notifData.status as CustomerOrderStatus,
          title: notifData.title,
          message: notifData.message,
          is_dismissed: notifData.is_dismissed,
          created_at: notifData.created_at,
        },
      };
    }

    // 2. Fallback: If no notifications table or no rows found, inspect the customer's latest order from customer_orders
    const { data: latestOrder, error: orderErr } = await supabase
      .from("customer_orders")
      .select("id, status, updated_at, created_at")
      .eq("customer_id", customerRecord.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orderErr || !latestOrder) {
      return { success: true, data: null };
    }

    const orderStatus = latestOrder.status as CustomerOrderStatus;
    const config = ORDER_STATUS_NOTIFICATION_CONFIG[orderStatus];

    if (!config) {
      return { success: true, data: null };
    }

    return {
      success: true,
      data: {
        id: `virtual-${latestOrder.id}-${orderStatus}`,
        order_id: latestOrder.id,
        status: orderStatus,
        title: config.title,
        message: config.message,
        is_dismissed: false,
        created_at: latestOrder.updated_at || latestOrder.created_at,
      },
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to load customer order notification.",
    };
  }
}

/**
 * Dismisses a notification for the current customer.
 */
export async function dismissCustomerOrderNotification(
  notificationId: string
): Promise<ActionResult> {
  const caller = await getCurrentUserProfile();

  if (!caller || !caller.is_active || caller.role !== "CUSTOMER") {
    return { success: false, error: "Unauthorized." };
  }

  const customerRecord = await resolveCustomerRecord(caller.id);
  if (!customerRecord) {
    return { success: false, error: "Customer record not found." };
  }

  // Virtual notification ID (fallback mode)
  if (notificationId.startsWith("virtual-")) {
    return { success: true };
  }

  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("customer_order_notifications")
      .update({ is_dismissed: true, updated_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("customer_id", customerRecord.id);

    if (error && !error.message?.includes("does not exist")) {
      return { success: false, error: error.message };
    }

    revalidatePath("/customer/order");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to dismiss notification.",
    };
  }
}
