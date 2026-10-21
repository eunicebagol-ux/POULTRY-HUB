/**
 * POULTRY HUB — Customer Payment Submission Zod Validation Schemas
 *
 * Validates inputs for the customer payment submission API (Migration 015).
 *
 * SECURITY CONTRACT:
 *   - customer_id is NEVER accepted from the client; resolved server-side.
 *   - verified_by, verified_at, verification_notes, rejection_reason are
 *     NEVER accepted from the customer; set only by STAFF/ADMIN actions.
 *   - declared_amount is informational only; authoritative total is set
 *     by Staff/Admin at fulfillment via record_egg_sale().
 *   - status on insert is always 'SUBMITTED'; cannot be set by the customer.
 */

import { z } from "zod";

export const CUSTOMER_PAYMENT_METHOD_VALUES = [
  "CASH_ON_DELIVERY",
  "CASH_ON_PICKUP",
  "GCASH",
  "BANK_TRANSFER",
] as const;

export const CUSTOMER_PAYMENT_STATUS_VALUES = [
  "PENDING_SUBMISSION",
  "SUBMITTED",
  "VERIFIED",
  "REJECTED",
  "REFUNDED",
] as const;

// ─── Submit Payment Submission Schema (CUSTOMER) ──────────────────────────────

export const submitPaymentSubmissionSchema = z
  .object({
    order_id: z.string().uuid("Invalid order ID."),
    payment_method: z.enum(CUSTOMER_PAYMENT_METHOD_VALUES, {
      message: "Please select a valid payment method.",
    }),
    declared_amount: z
      .number({ message: "Amount must be a number." })
      .finite("Declared amount must be a finite number.")
      .positive("Declared amount must be greater than zero.")
      .max(9_999_999, "Amount exceeds allowed maximum.")
      .optional(),
    reference_number: z
      .string()
      .trim()
      .max(200, "Reference number must be at most 200 characters.")
      .optional()
      .or(z.literal("")),
    payment_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Payment date must be in YYYY-MM-DD format.")
      .optional()
      .or(z.literal("")),
    bank_name: z
      .string()
      .trim()
      .max(100, "Bank name must be at most 100 characters.")
      .optional()
      .or(z.literal("")),
    sender_name: z
      .string()
      .trim()
      .max(150, "Sender name must be at most 150 characters.")
      .optional()
      .or(z.literal("")),
    gcash_number: z
      .string()
      .trim()
      .max(25, "GCash number must be at most 25 characters.")
      .optional()
      .or(z.literal("")),
    receipt_url: z
      .string()
      .trim()
      .optional()
      .or(z.literal("")),
    bank_transfer_account_id: z
      .string()
      .uuid("Invalid receiving bank account ID.")
      .optional()
      .nullable()
      .or(z.literal("")),
    customer_notes: z
      .string()
      .trim()
      .max(500, "Notes must be at most 500 characters.")
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) => {
      // Bank Transfer requires a reference number
      if (
        data.payment_method === "BANK_TRANSFER" &&
        !data.reference_number?.trim()
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        "A transaction reference number is required for Bank Transfer payments.",
      path: ["reference_number"],
    }
  )
  .refine(
    (data) => {
      // Bank Transfer requires sender bank name
      if (
        data.payment_method === "BANK_TRANSFER" &&
        (!data.bank_name || data.bank_name.trim().length < 2)
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Sender bank name is required for Bank Transfer payments.",
      path: ["bank_name"],
    }
  )
  .refine(
    (data) => {
      // Bank Transfer requires sender account holder name
      if (
        data.payment_method === "BANK_TRANSFER" &&
        (!data.sender_name || data.sender_name.trim().length < 2)
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Sender account holder name is required for Bank Transfer payments.",
      path: ["sender_name"],
    }
  );

export type SubmitPaymentSubmissionInput = z.infer<
  typeof submitPaymentSubmissionSchema
>;

// ─── Verify Payment Schema (STAFF/ADMIN) ─────────────────────────────────────

export const verifyPaymentSubmissionSchema = z.object({
  submission_id: z.string().uuid("Invalid submission ID."),
  action: z.enum(["VERIFY", "REJECT"], {
    message: "Action must be VERIFY or REJECT.",
  }),
  verification_notes: z
    .string()
    .trim()
    .max(500, "Verification notes must be at most 500 characters.")
    .optional()
    .or(z.literal("")),
  rejection_reason: z
    .string()
    .trim()
    .max(500, "Rejection reason must be at most 500 characters.")
    .optional()
    .or(z.literal("")),
});

export type VerifyPaymentSubmissionInput = z.infer<
  typeof verifyPaymentSubmissionSchema
>;

// ─── Get Payment for Order Schema ────────────────────────────────────────────

export const getPaymentForOrderSchema = z.object({
  order_id: z.string().uuid("Invalid order ID."),
});

export type GetPaymentForOrderInput = z.infer<typeof getPaymentForOrderSchema>;
