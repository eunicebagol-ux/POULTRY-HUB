/**
 * POULTRY HUB — Payment Zod Validation Schema
 *
 * Validates inputs for the record_egg_payment() RPC.
 * Server (PostgreSQL RPC) is the sole authority for:
 *   - Remaining balance calculation
 *   - Overpayment rejection
 *   - Cancelled-sale rejection
 *   - Payment status update
 *
 * Client-side validation provides immediate user feedback only.
 */

import { z } from "zod";

export const PAYMENT_METHOD_VALUES = [
  "CASH",
  "BANK_TRANSFER",
  "CHECK",
  "E_WALLET",
] as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  CHECK: "Check",
  E_WALLET: "E-Wallet",
};

export const recordPaymentSchema = z.object({
  sale_id: z.string().uuid("A valid sale must be selected."),
  amount: z
    .number({ message: "Payment amount must be a number." })
    .positive("Payment amount must be greater than zero.")
    .max(999999999.99, "Payment amount is too large."),
  payment_method: z.enum(PAYMENT_METHOD_VALUES, {
    message: "Please select a payment method.",
  }),
  payment_date: z
    .string()
    .min(1, "Payment date is required.")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format."),
  reference_number: z
    .string()
    .trim()
    .max(100, "Reference number must be at most 100 characters.")
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .trim()
    .max(500, "Notes must be at most 500 characters.")
    .optional()
    .or(z.literal("")),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
