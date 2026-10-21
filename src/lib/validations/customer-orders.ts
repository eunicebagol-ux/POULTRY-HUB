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

export const EGG_TYPE_VALUES = ["WHITE", "BROWN"] as const;

export const FULFILLMENT_METHOD_VALUES = ["DELIVERY", "PICKUP"] as const;
export const CUSTOMER_ORDER_PAYMENT_METHOD_VALUES = [
  "CASH_ON_DELIVERY",
  "CASH_ON_PICKUP",
  "GCASH",
  "BANK_TRANSFER",
] as const;

// ─── Order Item Schema ────────────────────────────────────────────────────────

export const customerOrderItemSchema = z.object({
  size: z.enum(EGG_SIZE_VALUES, {
    message: "Please select a valid egg size.",
  }),
  packaging: z.enum(PACKAGING_TYPE_VALUES, {
    message: "Please select a valid packaging type.",
  }),
  egg_type: z.enum(EGG_TYPE_VALUES).optional().default("WHITE"),
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

export const submitCustomerOrderSchema = z
  .object({
    // customer_id is NOT here — it is resolved server-side only
    fulfillment_method: z.enum(FULFILLMENT_METHOD_VALUES, {
      message: "Please select a fulfillment method: Delivery or Pick Up.",
    }),
    payment_method: z.enum(CUSTOMER_ORDER_PAYMENT_METHOD_VALUES, {
      message: "Please select a payment method.",
    }),
    requested_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format.")
      .optional()
      .or(z.literal("")),
    // Delivery-specific fields
    delivery_barangay: z
      .string()
      .trim()
      .max(100, "Barangay name must be at most 100 characters.")
      .optional()
      .or(z.literal("")),
    delivery_address: z
      .string()
      .trim()
      .max(500, "Delivery address must be at most 500 characters.")
      .optional()
      .or(z.literal("")),
    // Pickup-specific fields
    pickup_time: z
      .string()
      .trim()
      .max(50, "Pickup time must be at most 50 characters.")
      .optional()
      .or(z.literal("")),
    notes: z
      .string()
      .trim()
      .max(1000, "Notes must be at most 1000 characters.")
      .optional()
      .or(z.literal("")),
    // Payment details for digital methods (GCash / Bank Transfer)
    payment_reference: z
      .string()
      .trim()
      .max(200, "Transaction reference must be at most 200 characters.")
      .optional()
      .or(z.literal("")),
    payment_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Payment date must be in YYYY-MM-DD format.")
      .optional()
      .or(z.literal("")),
    payment_amount: z
      .number({ message: "Payment amount must be a number." })
      .finite("Payment amount must be a finite number.")
      .positive("Payment amount must be greater than zero.")
      .max(9_999_999, "Payment amount exceeds allowed maximum.")
      .optional(),
    payment_bank_name: z
      .string()
      .trim()
      .max(100, "Bank name must be at most 100 characters.")
      .optional()
      .or(z.literal("")),
    payment_sender_name: z
      .string()
      .trim()
      .max(150, "Sender name must be at most 150 characters.")
      .optional()
      .or(z.literal("")),
    payment_bank_transfer_account_id: z
      .string()
      .uuid("Invalid receiving bank account ID.")
      .optional()
      .nullable()
      .or(z.literal("")),
    payment_gcash_number: z
      .string()
      .trim()
      .max(25, "GCash number must be at most 25 characters.")
      .optional()
      .or(z.literal("")),
    payment_gcash_account_name: z
      .string()
      .trim()
      .max(150, "GCash account name must be at most 150 characters.")
      .optional()
      .or(z.literal("")),
    payment_receipt_url: z
      .string()
      .trim()
      .optional()
      .or(z.literal("")),
    payment_notes: z
      .string()
      .trim()
      .max(500, "Payment notes must be at most 500 characters.")
      .optional()
      .or(z.literal("")),
    items: z
      .array(customerOrderItemSchema)
      .min(1, "At least one item is required.")
      .max(20, "An order may not have more than 20 line items."),
  })
  .superRefine((data, ctx) => {
    // Cross-validate fulfillment method and payment method
    if (data.fulfillment_method === "DELIVERY" && data.payment_method === "CASH_ON_PICKUP") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cash on Pick Up is only available for Pick Up orders.",
        path: ["payment_method"],
      });
    }
    if (data.fulfillment_method === "PICKUP" && data.payment_method === "CASH_ON_DELIVERY") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cash on Delivery is only available for Delivery orders.",
        path: ["payment_method"],
      });
    }

    if (data.fulfillment_method === "DELIVERY") {
      if (!data.delivery_barangay?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Barangay is required for delivery orders.",
          path: ["delivery_barangay"],
        });
      }
      if (!data.delivery_address?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Delivery address is required for delivery orders.",
          path: ["delivery_address"],
        });
      }
      if (!data.requested_date?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Requested delivery date is required.",
          path: ["requested_date"],
        });
      }
    }
    if (data.fulfillment_method === "PICKUP") {
      if (!data.requested_date?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Pickup date is required.",
          path: ["requested_date"],
        });
      }
      if (!data.pickup_time?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Preferred pickup time is required.",
          path: ["pickup_time"],
        });
      }
    }

    // Digital payment validation
    if (data.payment_method === "GCASH") {
      const cleanGcash = data.payment_gcash_number?.replace(/[\s-]/g, "") || "";
      if (!cleanGcash) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "GCash number is required.",
          path: ["payment_gcash_number"],
        });
      } else if (!/^(09|\+639)\d{9}$/.test(cleanGcash)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter a valid 11-digit GCash number (e.g., 09171234567).",
          path: ["payment_gcash_number"],
        });
      }

      if (!data.payment_gcash_account_name?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "GCash account name is required.",
          path: ["payment_gcash_account_name"],
        });
      }
      // Note: payment_reference is optional because customers may not have paid yet.
      // Payment proof (receipt_url) is optional.
    }

    if (data.payment_method === "BANK_TRANSFER") {
      if (!data.payment_bank_name?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Bank name is required for Bank Transfer payments.",
          path: ["payment_bank_name"],
        });
      }
      if (!data.payment_sender_name?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Sender name is required for Bank Transfer payments.",
          path: ["payment_sender_name"],
        });
      }
      if (!data.payment_reference?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Transaction reference is required for Bank Transfer payments.",
          path: ["payment_reference"],
        });
      }
      if (!data.payment_date?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Payment date is required for Bank Transfer payments.",
          path: ["payment_date"],
        });
      }
      if (!data.payment_amount || data.payment_amount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Amount transferred is required for Bank Transfer payments.",
          path: ["payment_amount"],
        });
      }
    }
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
