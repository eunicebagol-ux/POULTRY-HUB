import { z } from "zod";
import { COLLECTION_SHIFTS } from "@/lib/constants";

// ── Record Egg Production Schema ──────────────────────────────────────────────

export const recordEggProductionSchema = z
  .object({
    flock_id: z.string().uuid("Please select a valid flock"),
    production_date: z.string().min(1, "Production date is required"),
    collection_shift: z.enum(COLLECTION_SHIFTS, {
      message: "Please select a valid collection shift",
    }),
    sizes: z.object({
      SMALL: z
        .number({ message: "Quantity must be a number" })
        .int("Must be a whole number")
        .min(0, "Cannot be negative")
        .default(0),
      MEDIUM: z
        .number({ message: "Quantity must be a number" })
        .int("Must be a whole number")
        .min(0, "Cannot be negative")
        .default(0),
      LARGE: z
        .number({ message: "Quantity must be a number" })
        .int("Must be a whole number")
        .min(0, "Cannot be negative")
        .default(0),
      EXTRA_LARGE: z
        .number({ message: "Quantity must be a number" })
        .int("Must be a whole number")
        .min(0, "Cannot be negative")
        .default(0),
      JUMBO: z
        .number({ message: "Quantity must be a number" })
        .int("Must be a whole number")
        .min(0, "Cannot be negative")
        .default(0),
      UNGRADED: z
        .number({ message: "Quantity must be a number" })
        .int("Must be a whole number")
        .min(0, "Cannot be negative")
        .default(0),
    }),
    damaged_eggs: z
      .number({ message: "Damaged eggs must be a number" })
      .int("Must be a whole number")
      .min(0, "Cannot be negative")
      .default(0),
    cracked_eggs: z
      .number({ message: "Cracked eggs must be a number" })
      .int("Must be a whole number")
      .min(0, "Cannot be negative")
      .default(0),
    notes: z.string().max(1000, "Notes must be 1000 characters or fewer").optional(),
  })
  .refine(
    (data) => {
      const goodTotal =
        data.sizes.SMALL +
        data.sizes.MEDIUM +
        data.sizes.LARGE +
        data.sizes.EXTRA_LARGE +
        data.sizes.JUMBO +
        data.sizes.UNGRADED;
      const grandTotal = goodTotal + data.damaged_eggs + data.cracked_eggs;
      return grandTotal > 0;
    },
    {
      message: "Total egg collection must be greater than zero.",
      path: ["sizes"],
    }
  );

export type RecordEggProductionInput = z.infer<typeof recordEggProductionSchema>;
