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
  "GCASH",
  "BANK_TRANSFER",
  "CASH_ON_DELIVERY",
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
    customer_notes: z
      .string()
      .trim()
      .max(500, "Notes must be at most 500 characters.")
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) => {
      // GCash and Bank Transfer require a reference number
      if (
        (data.payment_method === "GCASH" ||
          data.payment_method === "BANK_TRANSFER") &&
        !data.reference_number?.trim()
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        "A transaction reference number is required for GCash and Bank Transfer payments.",
      path: ["reference_number"],
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
