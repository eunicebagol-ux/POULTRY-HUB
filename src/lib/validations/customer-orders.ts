/**
 * POULTRY HUB — Customer Order Zod Validation Schemas
 *
 * Validates inputs for the customer order intake API (Migration 014).
 *
 * SECURITY CONTRACT:
 *   - customer_id is NEVER accepted from the client.
 *     It is always resolved server-side via get_current_customer_id().
 *   - status, sale_id, admin_notes, and cancellation_reason are
 *     NEVER set by customer-facing actions.
 *   - quoted_unit_price is a snapshot from the catalog at submission time.
 *     It is informational only and is NOT used for financial calculations.
 *   - Server (PostgreSQL record_egg_sale() RPC) is the sole authority for
 *     pricing, inventory, and totals at fulfillment time.
 */

import { z } from "zod";

export const ORDER_STATUS_VALUES = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
] as const;

export const EGG_SIZE_VALUES = [
  "SMALL",
  "MEDIUM",
  "LARGE",
  "EXTRA_LARGE",
  "JUMBO",
  "UNGRADED",
] as const;

export const PACKAGING_TYPE_VALUES = [
  "PIECE",
  "TRAY_30",
  "CARTON_12",
  "BOX_360",
] as const;

// ─── Order Item Schema ────────────────────────────────────────────────────────

export const customerOrderItemSchema = z.object({
  size: z.enum(EGG_SIZE_VALUES, {
    message: "Please select a valid egg size.",
  }),
  packaging: z.enum(PACKAGING_TYPE_VALUES, {
    message: "Please select a valid packaging type.",
  }),
  package_quantity: z
    .number({ message: "Quantity must be a number." })
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(10000, "Quantity must not exceed 10,000."),
  // quoted_unit_price: must be a non-negative number from the catalog snapshot.
  // Server action validates this is >= 0 and matches the catalog at submission time.
  quoted_unit_price: z
    .number({ message: "Unit price must be a number." })
    .min(0, "Unit price cannot be negative."),
});

export type CustomerOrderItemInput = z.infer<typeof customerOrderItemSchema>;

// ─── Submit Order Schema ──────────────────────────────────────────────────────

export const submitCustomerOrderSchema = z.object({
  // customer_id is NOT here — it is resolved server-side only
  requested_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format.")
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .trim()
    .max(1000, "Notes must be at most 1000 characters.")
    .optional()
    .or(z.literal("")),
  items: z
    .array(customerOrderItemSchema)
    .min(1, "At least one item is required.")
    .max(20, "An order may not have more than 20 line items."),
});

export type SubmitCustomerOrderInput = z.infer<typeof submitCustomerOrderSchema>;

// ─── Cancel Order Schema (customer-accessible) ───────────────────────────────

export const cancelCustomerOrderSchema = z.object({
  order_id: z.string().uuid("Invalid order ID."),
});

export type CancelCustomerOrderInput = z.infer<typeof cancelCustomerOrderSchema>;

// ─── Update Order Status Schema (STAFF/ADMIN only) ───────────────────────────

export const updateOrderStatusSchema = z
  .object({
    order_id: z.string().uuid("Invalid order ID."),
    status: z.enum(ORDER_STATUS_VALUES, {
      message: "Invalid order status.",
    }),
    admin_notes: z
      .string()
      .trim()
      .max(1000, "Admin notes must be at most 1000 characters.")
      .optional()
      .or(z.literal("")),
    cancellation_reason: z
      .string()
      .trim()
      .max(500, "Cancellation reason must be at most 500 characters.")
      .optional()
      .or(z.literal("")),
    sale_id: z
      .string()
      .uuid("Invalid sale ID.")
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.status === "CANCELLED" &&
      (!data.cancellation_reason || !data.cancellation_reason.trim())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A cancellation reason is required when cancelling an order.",
        path: ["cancellation_reason"],
      });
    }
  });

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
