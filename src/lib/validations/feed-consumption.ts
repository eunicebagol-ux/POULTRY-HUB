import { z } from "zod";

export const recordFeedConsumptionSchema = z.object({
  flock_id: z
    .string()
    .uuid("Please select a valid active flock."),
  feed_type: z
    .string()
    .trim()
    .min(1, "Feed type is required.")
    .max(100, "Feed type must be at most 100 characters."),
  quantity_kg: z
    .number({ message: "Quantity must be a valid number." })
    .positive("Quantity must be greater than zero.")
    .refine(
      (val) => {
        const decimals = val.toString().split(".")[1];
        return !decimals || decimals.length <= 2;
      },
      { message: "Quantity cannot exceed 2 decimal places." }
    ),
  consumption_date: z
    .string()
    .min(1, "Consumption date is required.")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format."),
  notes: z
    .string()
    .trim()
    .max(500, "Notes must be at most 500 characters.")
    .optional()
    .or(z.literal("")),
});

export type RecordFeedConsumptionInput = z.infer<
  typeof recordFeedConsumptionSchema
>;
