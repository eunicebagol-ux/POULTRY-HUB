/**
 * POULTRY HUB — Egg Inventory Zod Validation
 *
 * Validates input for the adjust_egg_inventory() RPC.
 * The RPC accepts:
 *   p_size       — egg size (EggSize enum value)
 *   p_adjustment — signed integer (positive = add, negative = deduct)
 *   p_reason     — mandatory justification string (non-empty)
 *
 * Security: The RPC enforces ADMIN-only access and prevents negative stock_pieces.
 * The Server Action re-validates these rules before calling the RPC.
 *
 * Zod v4 compatible: uses { message: "..." } instead of required_error / invalid_type_error.
 */

import { z } from "zod";

// Literal const tuple so z.enum() receives the correct overload signature
const EGG_SIZE_VALUES = [
  "SMALL",
  "MEDIUM",
  "LARGE",
  "EXTRA_LARGE",
  "JUMBO",
  "UNGRADED",
] as const;

export const adjustEggInventorySchema = z.object({
  size: z.enum(EGG_SIZE_VALUES, {
    message: "Please select a valid egg size.",
  }),
  adjustment: z
    .number({ message: "Adjustment must be a number." })
    .int("Adjustment must be a whole number (pieces).")
    .refine((v) => v !== 0, { message: "Adjustment amount cannot be zero." }),
  reason: z
    .string()
    .min(10, "Reason must be at least 10 characters.")
    .max(500, "Reason must be at most 500 characters."),
});

export type AdjustEggInventoryInput = z.infer<typeof adjustEggInventorySchema>;
