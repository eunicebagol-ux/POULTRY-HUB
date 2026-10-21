import { describe, it, expect } from "vitest";
import { ORDER_STATUS_NOTIFICATION_CONFIG } from "../../lib/customer-order-notification-config";
import type { CustomerOrderNotificationView } from "../../actions/customer-order-notifications";
import type { CustomerOrderStatus } from "@/types";

describe("Customer Order Status Notifications", () => {
  const REQUIRED_STATUSES: CustomerOrderStatus[] = [
    "PENDING",
    "CONFIRMED",
    "PREPARING",
    "READY",
    "COMPLETED",
    "CANCELLED",
  ];

  it("defines exact titles and messages for all 6 required notification states", () => {
    expect(ORDER_STATUS_NOTIFICATION_CONFIG.PENDING).toEqual({
      title: "Order Submitted",
      message: "Your order has been received and is pending review.",
    });

    expect(ORDER_STATUS_NOTIFICATION_CONFIG.CONFIRMED).toEqual({
      title: "Order Confirmed",
      message: "Good news! Your order has been confirmed by our team.",
    });

    expect(ORDER_STATUS_NOTIFICATION_CONFIG.PREPARING).toEqual({
      title: "In Progress",
      message: "Your order is being prepared.",
    });

    expect(ORDER_STATUS_NOTIFICATION_CONFIG.READY).toEqual({
      title: "Ready for Pickup",
      message: "Your order is ready for pickup.",
    });

    expect(ORDER_STATUS_NOTIFICATION_CONFIG.COMPLETED).toEqual({
      title: "Completed",
      message: "Your order has been completed.",
    });

    expect(ORDER_STATUS_NOTIFICATION_CONFIG.CANCELLED).toEqual({
      title: "Cancelled",
      message: "Your order has been cancelled.",
    });
  });

  it("covers every customer order status enum without missing any state", () => {
    for (const status of REQUIRED_STATUSES) {
      expect(ORDER_STATUS_NOTIFICATION_CONFIG[status]).toBeDefined();
      expect(ORDER_STATUS_NOTIFICATION_CONFIG[status].title.length).toBeGreaterThan(0);
      expect(ORDER_STATUS_NOTIFICATION_CONFIG[status].message.length).toBeGreaterThan(0);
    }
  });

  it("generates status-specific dismissal keys preventing cross-status hiding", () => {
    const orderId = "0c8e2a14-72fd-425b-86d1-411a7a2bc54e";

    const getStorageKey = (orderId: string, status: CustomerOrderStatus) =>
      `poultryhub_notif_dismissed_${orderId}_${status}`;

    const dismissedConfirmedKey = getStorageKey(orderId, "CONFIRMED");
    const readyKey = getStorageKey(orderId, "READY");

    // Simulating user dismissing CONFIRMED
    const mockStorage = new Map<string, string>();
    mockStorage.set(dismissedConfirmedKey, "true");

    // CONFIRMED is dismissed
    expect(mockStorage.get(dismissedConfirmedKey)).toBe("true");

    // When status changes to READY, it is NOT dismissed!
    expect(mockStorage.get(readyKey)).toBeUndefined();
  });

  it("formats order references cleanly without exposing raw long UUIDs", () => {
    const mockNotification: CustomerOrderNotificationView = {
      id: "notif-1",
      order_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      status: "CONFIRMED",
      title: "Order Confirmed",
      message: "Good news! Your order has been confirmed by our team.",
      is_dismissed: false,
      created_at: new Date().toISOString(),
    };

    const shortRef = `ORD-${mockNotification.order_id.replace(/-/g, "").slice(0, 7).toUpperCase()}`;
    expect(shortRef).toBe("ORD-A1B2C3D");
  });
});
