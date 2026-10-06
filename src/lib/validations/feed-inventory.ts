import { z } from "zod";

export const receiveFeedStockSchema = z.object({
  feed_type: z
    .string()
    .trim()
    .min(1, "Feed type is required.")
    .max(100, "Feed type must be at most 100 characters."),
  quantity_kg: z
    .number({ message: "Quantity must be a number." })
    .positive("Quantity must be greater than zero."),
  cost_per_kg: z
    .number({ message: "Cost per kg must be a number." })
    .min(0, "Cost per kg cannot be negative."),
  supplier_id: z
    .string()
    .uuid("Please select a valid supplier.")
    .optional()
    .nullable(),
  intake_date: z
    .string()
    .min(1, "Intake date is required.")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format."),
  notes: z
    .string()
    .trim()
    .max(500, "Notes must be at most 500 characters.")
    .optional()
    .or(z.literal("")),
});

export type ReceiveFeedStockInput = z.infer<typeof receiveFeedStockSchema>;
