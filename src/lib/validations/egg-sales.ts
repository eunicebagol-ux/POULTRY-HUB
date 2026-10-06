/**
 * POULTRY HUB — Egg Sales Zod Validation Schemas
 *
 * Aligned with the database schema and record_egg_sale() RPC:
 * - p_customer_id: UUID
 * - p_sale_date: DATE (YYYY-MM-DD)
 * - p_invoice_number: TEXT (optional)
 * - p_discount: NUMERIC(12,2) (>= 0)
 * - p_notes: TEXT (optional)
 * - p_items: JSONB array of { size, packaging, package_quantity, unit_price }
 *
 * Zod v4 compatible: uses { message: "..." } instead of required_error / invalid_type_error.
 */

import { z } from "zod";

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

export const eggSaleItemSchema = z.object({
  size: z.enum(EGG_SIZE_VALUES, {
    message: "Please select an egg size.",
  }),
  packaging: z.enum(PACKAGING_TYPE_VALUES, {
    message: "Please select a packaging type.",
  }),
  package_quantity: z
    .number({ message: "Quantity must be a number." })
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1."),
  unit_price: z
    .number({ message: "Unit price must be a number." })
    .min(0, "Unit price cannot be negative."),
});

export type EggSaleItemInput = z.infer<typeof eggSaleItemSchema>;

export const recordEggSaleSchema = z.object({
  customer_id: z.string().uuid("Please select a valid customer."),
  sale_date: z
    .string()
    .min(1, "Sale date is required.")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format."),
  invoice_number: z
    .string()
    .trim()
    .max(50, "Invoice number must be at most 50 characters.")
    .optional()
    .or(z.literal("")),
  discount: z
    .number({ message: "Discount must be a number." })
    .min(0, "Discount cannot be negative.")
    .default(0),
  notes: z
    .string()
    .trim()
    .max(500, "Notes must be at most 500 characters.")
    .optional()
    .or(z.literal("")),
  items: z
    .array(eggSaleItemSchema)
    .min(1, "At least one sale item is required."),
});

export type RecordEggSaleInput = z.infer<typeof recordEggSaleSchema>;

export const createCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Customer name must be at least 2 characters.")
    .max(100, "Customer name must be at most 100 characters."),
  contact_person: z
    .string()
    .trim()
    .max(100, "Contact person must be at most 100 characters.")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .max(50, "Phone number must be at most 50 characters.")
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address.")
    .optional()
    .or(z.literal("")),
  address: z
    .string()
    .trim()
    .max(255, "Address must be at most 255 characters.")
    .optional()
    .or(z.literal("")),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
