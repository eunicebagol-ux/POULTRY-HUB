/**
 * POULTRY HUB — Customer Order Notification Configuration
 *
 * Shared, pure-data module. No server-side code. Safe to import in:
 *   - Server Actions  (src/actions/)
 *   - Client components (src/components/)
 *   - Unit tests        (src/lib/__tests__/)
 *
 * Kept separate from the "use server" actions file because Next.js 16
 * requires every export in a "use server" module to be an async function.
 */

import type { CustomerOrderStatus } from "@/types";

export interface CustomerOrderNotificationView {
  id: string;
  order_id: string;
  status: CustomerOrderStatus;
  title: string;
  message: string;
  is_dismissed: boolean;
  created_at: string;
}

export const ORDER_STATUS_NOTIFICATION_CONFIG: Record<
  CustomerOrderStatus,
  { title: string; message: string }
> = {
  PENDING: {
    title: "Order Submitted",
    message: "Your order has been received and is pending review.",
  },
  CONFIRMED: {
    title: "Order Confirmed",
    message: "Good news! Your order has been confirmed by our team.",
  },
  PREPARING: {
    title: "In Progress",
    message: "Your order is being prepared.",
  },
  READY: {
    title: "Ready for Pickup",
    message: "Your order is ready for pickup.",
  },
  COMPLETED: {
    title: "Completed",
    message: "Your order has been completed.",
  },
  CANCELLED: {
    title: "Cancelled",
    message: "Your order has been cancelled.",
  },
};
